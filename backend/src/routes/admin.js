const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const crypto = require('crypto');
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Delivery = require('../models/Delivery');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { createNotification } = require('../services/notificationService');
const { getPagination, paginationResult } = require('../utils/pagination');
const { withMongoTransaction, respondToDatabaseWriteError } = require('../config/db');

router.use(verifyToken, requireRole(['admin']));

async function getSystemStats() {
  const [
    [batchStats],
    farmers,
    consumers,
    agents,
    activeSubscriptions,
    pendingOrders,
    completedDeliveries,
    [revenueStats],
    [pendingWithdrawalStats]
  ] = await Promise.all([
    MilkBatch.aggregate([{
      $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        acceptedBatches: { $sum: { $cond: [{ $in: ['$status', ['Accepted', 'In Transit', 'Delivered']] }, 1, 0] } },
        rejectedBatches: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
        inTransitBatches: { $sum: { $cond: [{ $eq: ['$status', 'In Transit'] }, 1, 0] } },
        deliveredBatches: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] } },
        collectedBatches: { $sum: { $cond: [{ $in: ['$status', ['Collected', 'Quality Checked']] }, 1, 0] } },
        totalLitersCollected: { $sum: { $ifNull: ['$liters', 0] } },
        totalPayoutsValue: {
          $sum: {
            $cond: [{ $in: ['$status', ['Accepted', 'Delivered', 'In Transit']] }, { $ifNull: ['$qualityTest.totalPrice', 0] }, 0]
          }
        }
      }
    }]),
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'consumer' }),
    User.countDocuments({ role: { $in: ['agent', 'delivery_agent'] } }),
    Subscription.countDocuments({ status: 'Active' }),
    Order.countDocuments({ status: { $in: ['Pending', 'Confirmed', 'Assigned'] } }),
    Delivery.countDocuments({ status: 'Delivered' }),
    Order.aggregate([{ $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }]),
    Transaction.aggregate([
      { $match: { type: 'Bank Withdrawal', status: 'Processing' } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
    ])
  ]);
  return {
    ...(batchStats || {
      totalBatches: 0, acceptedBatches: 0, rejectedBatches: 0, inTransitBatches: 0,
      deliveredBatches: 0, collectedBatches: 0, totalLitersCollected: 0, totalPayoutsValue: 0
    }),
    usersCount: { farmers, consumers, agents },
    activeSubscriptions,
    pendingOrders,
    completedDeliveries,
    totalRevenue: revenueStats?.totalRevenue || 0,
    pendingWithdrawals: pendingWithdrawalStats || { count: 0, amount: 0 }
  };
}

router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getSystemStats();
    return res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load admin dashboard.' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getSystemStats();
    return res.json({
      success: true,
      stats: {
        totalFarmers: stats.usersCount.farmers,
        totalConsumers: stats.usersCount.consumers,
        totalAgents: stats.usersCount.agents,
        totalBatches: stats.totalBatches,
        totalLitersCollected: stats.totalLitersCollected,
        platformRevenue: stats.totalRevenue,
        activeSubscriptions: stats.activeSubscriptions,
        pendingOrders: stats.pendingOrders,
        completedDeliveries: stats.completedDeliveries,
        pendingWithdrawals: stats.pendingWithdrawals
      }
    });
  } catch (error) {
    console.error('Error retrieving admin stats:', error);
    return res.status(500).json({ success: false, message: 'Unable to retrieve admin stats.' });
  }
});

const recordKinds = {
  batches: { model: MilkBatch, select: 'batchId farmerId farmerName farmName agentId agentName liters status collectionDate notes qualityTest rejection auditHistory' },
  rejections: { model: MilkBatch, select: 'batchId farmerId farmerName farmName agentId agentName liters status collectionDate rejection auditHistory', filter: { $or: [{ status: 'Rejected' }, { rejection: { $ne: null } }] } },
  quality: { model: MilkBatch, select: 'batchId farmerId farmerName farmName agentId agentName liters status collectionDate qualityTest', filter: { qualityTest: { $ne: null } } },
  farmers: { model: User, select: 'name phoneNumber role farmName location balance cattleCount createdAt' },
  consumers: { model: User, select: 'name phoneNumber role address createdAt', filter: { role: 'consumer' } },
  agents: { model: User, select: 'name phoneNumber role assignedArea vehicleNo balance totalDeliveries createdAt', filter: { role: { $in: ['agent', 'delivery_agent'] } } },
  users: { model: User, select: 'name phoneNumber role farmName address assignedArea balance isActive createdAt' },
  orders: { model: Order, select: 'orderId consumerId items quantity totalAmount deliveryDate deliveryAddress status assignedAgentId createdAt tracking' },
  subscriptions: { model: Subscription, select: 'subscriptionId consumerId planName planType dailyLiters totalDays daysRemaining status schedule deliveryTimeSlot startDate endDate pauseStartDate pauseEndDate createdAt' },
  deliveries: { model: Delivery, select: 'deliveryId orderId consumerId batchId agentId deliveryAddress quantity status eta timeSlot commission deliveredAt tracking createdAt' },
  transactions: { model: Transaction, select: 'farmerId agentId amount type status reference date timestamp createdAt' },
  withdrawals: { model: Transaction, select: 'farmerId agentId amount type status reference date timestamp createdAt', filter: { type: 'Bank Withdrawal' } },
  notifications: { model: Notification, select: 'userId role title message type read createdAt' },
  audit: { model: AuditLog, select: 'actorId actorRole action entityType entityId details createdAt' }
};

router.get('/records', async (req, res) => {
  try {
    const kind = recordKinds[req.query.kind] ? req.query.kind : 'batches';
    const { page, limit, skip } = getPagination(req.query, 6);
    const config = recordKinds[kind];
    const filter = { ...(config.filter || {}) };
    const status = String(req.query.status || '').trim();
    if (status && status !== 'All' && status !== 'all') filter.status = status;
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      const searchableFields = kind === 'orders' ? ['orderId', 'consumerId', 'deliveryAddress']
        : kind === 'subscriptions' ? ['subscriptionId', 'consumerId', 'planName']
          : kind === 'deliveries' ? ['deliveryId', 'orderId', 'consumerId', 'agentId']
            : kind === 'notifications' ? ['title', 'message', 'userId']
              : kind === 'audit' ? ['action', 'entityType', 'entityId']
                : ['batchId', 'farmerName', 'farmName', 'agentName', 'name', 'phoneNumber', 'reference'];
      const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [...(filter.$and || []), { $or: searchableFields.map(field => ({ [field]: expression })) }];
    }
    const [records, totalItems] = await Promise.all([
      config.model.find(filter).select(config.select).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      config.model.countDocuments(filter)
    ]);
    return res.json({
      success: true,
      kind,
      page,
      pageSize: limit,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      records
    });
  } catch (error) {
    console.error('Error fetching admin records:', error);
    return res.status(500).json({ success: false, message: 'Unable to load registry records.' });
  }
});

router.get('/quality-history', async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const match = { qualityHistory: { $exists: true, $ne: [] } };
    if (req.query.batchId) match.batchId = String(req.query.batchId);
    const [records, [countResult]] = await Promise.all([
      MilkBatch.aggregate([
        { $match: match },
        { $unwind: '$qualityHistory' },
        { $sort: { 'qualityHistory.testedAt': -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { batchId: 1, farmerId: 1, qualityHistory: 1 } }
      ]),
      MilkBatch.aggregate([
        { $match: match },
        { $project: { historyCount: { $size: '$qualityHistory' } } },
        { $group: { _id: null, totalItems: { $sum: '$historyCount' } } }
      ])
    ]);
    const totalItems = countResult?.totalItems || 0;
    return res.json({
      success: true,
      records,
      pagination: paginationResult(page, limit, totalItems)
    });
  } catch (error) {
    console.error('Error fetching paginated quality history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load quality history.' });
  }
});

async function reviewRejectedBatch(req, res, batchId, decision, adminRemarks) {
  const allowed = ['Confirmed Rejected', 'Under Review', 'Approved'];
  if (!allowed.includes(decision)) {
    return res.status(400).json({ success: false, message: `Invalid decision. Must be one of: ${allowed.join(', ')}` });
  }
  const existing = await MilkBatch.findOne({ batchId });
  if (!existing) return res.status(404).json({ success: false, message: `Batch ${batchId} not found.` });
  if (existing.status !== 'Rejected' || !existing.rejection) {
    return res.status(409).json({ success: false, message: 'Only rejected batches can be reviewed.' });
  }
  if (existing.rejection.reviewStatus === 'Approved') {
    return res.status(409).json({ success: false, message: 'This rejection has already been approved and paid.' });
  }
  const approved = decision === 'Approved';
  const result = await withMongoTransaction(async session => {
    const reviewedBatch = await MilkBatch.findOne({
      batchId,
      status: 'Rejected',
      'rejection.reviewStatus': { $ne: 'Approved' }
    }).session(session);
    if (!reviewedBatch) return null;
    const previousStatus = reviewedBatch.status;
    const payoutCredited = approved
      ? Math.round(reviewedBatch.liters * (reviewedBatch.qualityTest?.ratePerLiter || 45))
      : 0;
    reviewedBatch.rejection.reviewStatus = decision;
    reviewedBatch.rejection.reviewedBy = req.user.name;
    reviewedBatch.rejection.reviewedAt = new Date();
    reviewedBatch.rejection.adminRemarks = adminRemarks || '';
    if (approved) {
      reviewedBatch.status = 'Accepted';
      if (reviewedBatch.qualityTest) {
        reviewedBatch.qualityTest.qualityStatus = 'Passed';
        reviewedBatch.qualityTest.totalPrice = payoutCredited;
      }
    }
    reviewedBatch.addAuditLog(previousStatus, reviewedBatch.status, req.user.name, req.user.id, `Admin review: ${decision}`, adminRemarks);
    await reviewedBatch.save({ session });
    if (approved) {
      const farmer = await User.findByIdAndUpdate(
        reviewedBatch.farmerId,
        { $inc: { balance: payoutCredited } },
        { returnDocument: 'after', session }
      );
      if (!farmer) throw new Error('Farmer account is unavailable during rejection review settlement.');
      await Transaction.create([{
        farmerId: reviewedBatch.farmerId,
        amount: payoutCredited,
        type: `Credit (Admin Approved Batch ${batchId})`,
        status: 'Completed',
        reference: `ADMIN-APPROVED-${batchId}`
      }], { session, ordered: true });
    }
    await AuditLog.create([{
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `batch.review.${decision.toLowerCase().replace(/\s+/g, '-')}`,
      entityType: 'MilkBatch',
      entityId: batchId,
      details: { adminRemarks, payoutCredited }
    }], { session, ordered: true });
    await createNotification({
      userId: reviewedBatch.farmerId,
      role: 'farmer',
      title: `Batch ${batchId} review updated`,
      message: approved
        ? `Admin approved the batch and credited ₹${payoutCredited.toFixed(2)}.`
        : `Admin marked the batch "${decision}". ${adminRemarks || ''}`,
      type: approved ? 'success' : 'info',
      session
    });
    return { batch: reviewedBatch, payoutCredited };
  });
  if (!result) return res.status(409).json({ success: false, message: 'The rejection has already been reviewed or is no longer eligible.' });
  return res.json({
    success: true,
    message: `Batch ${batchId} review status updated to "${decision}".`,
    batch: result.batch,
    payoutCredited: result.payoutCredited
  });
}

router.post('/review-rejection', async (req, res) => {
  try {
    const { batchId, decision, adminRemarks } = req.body;
    return await reviewRejectedBatch(req, res, batchId, decision, adminRemarks);
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to process batch review.');
  }
});

router.post('/batches/:batchId/review', async (req, res) => {
  try {
    const { action, adminNotes } = req.body;
    if (!['RELEASE', 'CONFIRM_REJECTION'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Select a valid review action.' });
    }
    return await reviewRejectedBatch(
      req,
      res,
      req.params.batchId,
      action === 'RELEASE' ? 'Approved' : 'Confirmed Rejected',
      adminNotes
    );
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to process batch review.');
  }
});

router.post('/orders/:orderId/assign', async (req, res) => {
  try {
    const agentId = String(req.body.agentId || '');
    if (!mongoose.isValidObjectId(agentId) || !(await User.exists({ _id: agentId, role: { $in: ['agent', 'delivery_agent'] } }))) {
      return res.status(400).json({ success: false, message: 'A valid delivery agent is required.' });
    }
    const assignment = await withMongoTransaction(async session => {
      const order = await Order.findOne({ orderId: req.params.orderId }).session(session);
      if (!order) return { orderMissing: true };
      const delivery = await Delivery.findOneAndUpdate(
        { orderId: order.orderId, status: { $in: ['Pending', 'Assigned'] } },
        {
          $set: { agentId, status: 'Assigned' },
          $push: { tracking: { status: 'Assigned', changedBy: req.user.id, notes: 'Delivery agent assigned by admin.' } }
        },
        { returnDocument: 'after', session }
      );
      if (!delivery) return { deliveryMissing: true };
      order.assignedAgentId = agentId;
      order.status = 'Assigned';
      order.tracking.push({ status: 'Assigned', changedBy: req.user.id });
      await order.save({ session });
      await AuditLog.create([{
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'order.assign-agent',
        entityType: 'Order',
        entityId: order.orderId,
        details: { agentId }
      }], { session, ordered: true });
      await createNotification({
        userId: agentId,
        role: 'delivery_agent',
        title: 'New delivery assigned',
        message: `Order ${order.orderId} is assigned to you.`,
        type: 'info',
        session
      });
      await createNotification({
        userId: order.consumerId,
        role: 'consumer',
        title: 'Delivery agent assigned',
        message: `A delivery agent has been assigned to order ${order.orderId}.`,
        type: 'info',
        session
      });
      return { order, delivery };
    });
    if (assignment.orderMissing) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (assignment.deliveryMissing) return res.status(409).json({ success: false, message: 'Order delivery is no longer available for assignment.' });
    return res.json({ success: true, order: assignment.order, delivery: assignment.delivery });
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to assign order delivery.');
  }
});

router.post('/payouts/process', async (req, res) => {
  try {
    const payoutIds = req.body.payoutIds;
    if (!Array.isArray(payoutIds) || payoutIds.length > 100) {
      return res.status(400).json({ success: false, message: 'Provide up to 100 withdrawal IDs.' });
    }
    if (!payoutIds.every(id => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'Every withdrawal ID must be a valid identifier.' });
    }
    const processedCount = await withMongoTransaction(async session => {
      const result = await Transaction.updateMany(
        { _id: { $in: payoutIds }, type: 'Bank Withdrawal', status: 'Processing' },
        { $set: { status: 'Completed' } },
        { session }
      );
      await AuditLog.create([{
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'withdrawals.process',
        entityType: 'Transaction',
        entityId: payoutIds.join(','),
        details: { processedCount: result.modifiedCount }
      }], { session, ordered: true });
      return result.modifiedCount;
    });
    return res.json({
      success: true,
      message: `Processed ${processedCount} withdrawal requests.`,
      processedCount
    });
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to process withdrawal requests.');
  }
});

module.exports = router;

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { createNotification } = require('../services/notificationService');
const { getPagination, paginationResult } = require('../utils/pagination');
const { withMongoTransaction, respondToDatabaseWriteError } = require('../config/db');
const { getIdempotencyKey, hashPayload } = require('../utils/idempotency');

router.use(verifyToken, requireRole(['delivery_agent']));

router.get('/dashboard', async (req, res) => {
  try {
    const agentId = req.user.id;
    const pickupPage = getPagination({ ...req.query, page: req.query.pickupPage || req.query.page }, 6);
    const batchPage = getPagination({ ...req.query, page: req.query.batchPage || req.query.page }, 6);
    const deliveryPage = getPagination({ ...req.query, page: req.query.deliveryPage || req.query.page }, 6);
    const transactionPage = getPagination({ ...req.query, page: req.query.transactionPage || req.query.page }, 6);
    const pickupFilter = { status: 'Collected', $or: [{ agentId }, { agentId: { $in: ['', null] } }] };
    const deliveryFilter = { agentId, status: { $in: ['Assigned', 'Out for Delivery'] } };
    const [agent, pickups, pickupCount, batches, deliveries, deliveryCount, transactions, transactionCount] = await Promise.all([
      User.findById(agentId).select('name address vehicleNo assignedArea balance totalDeliveries bankDetails').lean(),
      MilkBatch.find(pickupFilter).sort({ collectionDate: -1, _id: -1 }).skip(pickupPage.skip).limit(pickupPage.limit).lean(),
      MilkBatch.countDocuments(pickupFilter),
      MilkBatch.find({ agentId }).sort({ collectionDate: -1, _id: -1 }).skip(batchPage.skip).limit(batchPage.limit).lean(),
      Delivery.find(deliveryFilter).sort({ createdAt: -1, _id: -1 }).skip(deliveryPage.skip).limit(deliveryPage.limit).lean(),
      Delivery.countDocuments(deliveryFilter),
      Transaction.find({ agentId }).sort({ timestamp: -1, _id: -1 }).skip(transactionPage.skip).limit(transactionPage.limit).lean(),
      Transaction.countDocuments({ agentId })
    ]);
    if (!agent) return res.status(404).json({ success: false, message: 'Delivery agent account not found.' });
    return res.json({
      success: true,
      agent: { ...agent, id: agentId },
      batches,
      farmerPickups: pickups,
      assignedPickups: pickups,
      consumerDeliveries: deliveries,
      transactions,
      pagination: {
        pickups: paginationResult(pickupPage.page, pickupPage.limit, pickupCount),
        batches: paginationResult(batchPage.page, batchPage.limit, await MilkBatch.countDocuments({ agentId })),
        deliveries: paginationResult(deliveryPage.page, deliveryPage.limit, deliveryCount),
        transactions: paginationResult(transactionPage.page, transactionPage.limit, transactionCount)
      }
    });
  } catch (error) {
    console.error('Error loading delivery dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load delivery dashboard.' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const agentId = req.user.id;
    const pickupFilter = {
      status: 'Collected',
      $or: [{ agentId }, { agentId: { $in: ['', null] } }]
    };
    const [farmerPickups, pickupCount, consumerDeliveries, deliveryCount] = await Promise.all([
      MilkBatch.find(pickupFilter).sort({ collectionDate: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      MilkBatch.countDocuments(pickupFilter),
      Delivery.find({ agentId, status: { $in: ['Assigned', 'Out for Delivery'] } })
        .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Delivery.countDocuments({ agentId, status: { $in: ['Assigned', 'Out for Delivery'] } })
    ]);
    return res.json({
      success: true,
      farmerPickups,
      consumerDeliveries,
      pagination: {
        pickups: paginationResult(page, limit, pickupCount),
        deliveries: paginationResult(page, limit, deliveryCount)
      }
    });
  } catch (error) {
    console.error('Error loading delivery tasks:', error);
    return res.status(500).json({ success: false, message: 'Unable to load delivery tasks.' });
  }
});

router.post('/test-and-collect', async (req, res) => {
  try {
    const { pickupId, batchId, testedFat, testedSNF, lactometerReading, temperature, liters, remarks } = req.body;
    const targetId = batchId || pickupId;
    const batch = await MilkBatch.findOne({ batchId: targetId });
    if (!batch) return res.status(404).json({ success: false, message: 'Milk batch not found.' });
    if (batch.status !== 'Collected') {
      return res.status(409).json({ success: false, message: 'This batch is no longer awaiting inspection.' });
    }

    const fat = Number(testedFat);
    const snf = Number(testedSNF);
    const lacto = lactometerReading == null ? 29.5 : Number(lactometerReading);
    const temp = temperature == null ? 4 : Number(temperature);
    const volume = liters == null ? batch.liters : Number(liters);
    if (!Number.isFinite(fat) || fat < 0.5 || fat > 15) {
      return res.status(400).json({ success: false, message: 'Invalid Fat %. Must be between 0.5% and 15.0%.' });
    }
    if (!Number.isFinite(snf) || snf < 4 || snf > 15) {
      return res.status(400).json({ success: false, message: 'Invalid SNF %. Must be between 4.0% and 15.0%.' });
    }
    if (!Number.isFinite(lacto) || lacto < 15 || lacto > 38) {
      return res.status(400).json({ success: false, message: 'Invalid Lactometer reading. Must be between 15.0 and 38.0.' });
    }
    if (!Number.isFinite(temp) || temp < -2 || temp > 45) {
      return res.status(400).json({ success: false, message: 'Invalid Temperature. Must be between -2°C and 45°C.' });
    }
    if (!Number.isFinite(volume) || volume <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid milk volume.' });
    }

    const ratePerLiter = Math.max(35, Math.round(45 + ((fat - 3.5) * 6) + ((snf - 8.5) * 4)));
    const totalPrice = Math.round(volume * ratePerLiter);
    const qualityScore = Math.min(100, Math.max(10, Math.round((fat / 4.5) * 45 + (snf / 8.5) * 45 + (lacto >= 28 ? 10 : 0))));
    const qualityStatus = qualityScore >= 80 ? 'Passed' : qualityScore >= 60 ? 'Needs Review' : 'Rejected';
    const testRecord = {
      fatPercentage: fat,
      snfPercentage: snf,
      lactometerReading: lacto,
      temperature: temp,
      qualityScore,
      qualityStatus,
      ratePerLiter,
      totalPrice,
      testedAt: new Date(),
      testedBy: req.user.name,
      testedById: req.user.id,
      remarks: remarks || ''
    };

    const payment = await withMongoTransaction(async session => {
      const farmerAccount = await User.findOne({ _id: batch.farmerId, role: 'farmer' }).session(session);
      const agentAccount = await User.findOne({ _id: req.user.id, role: { $in: ['agent', 'delivery_agent'] } }).session(session);
      if (!farmerAccount || !agentAccount) return { accountMissing: true };

      const acceptedBatch = await MilkBatch.findOneAndUpdate({
        batchId: targetId,
        status: 'Collected',
        $or: [{ agentId: req.user.id }, { agentId: '' }, { agentId: null }]
      }, {
        $set: {
          liters: volume,
          status: 'Accepted',
          agentId: req.user.id,
          agentName: req.user.name,
          qualityTest: testRecord
        },
        $push: {
          qualityHistory: testRecord,
          auditHistory: {
            fromStatus: 'Collected',
            toStatus: 'Accepted',
            changedBy: req.user.name,
            changedById: req.user.id,
            reason: 'Quality test passed and batch accepted',
            remarks: remarks || ''
          }
        }
      }, { returnDocument: 'after', session });
      if (!acceptedBatch) return { batchChanged: true };

      const farmer = await User.findByIdAndUpdate(
        batch.farmerId,
        { $inc: { balance: totalPrice } },
        { returnDocument: 'after', session }
      );
      const agent = await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { balance: 50, totalDeliveries: 1 } },
        { returnDocument: 'after', session }
      );
      if (!farmer || !agent) throw new Error('A financial account disappeared during batch settlement.');
      await Transaction.create([
        {
          farmerId: batch.farmerId,
          amount: totalPrice,
          type: `Credit (Batch ${batch.batchId} - Verified by Agent)`,
          status: 'Completed',
          reference: `BATCH-CREDIT-${batch.batchId}`
        },
        {
          agentId: req.user.id,
          amount: 50,
          type: `Credit (Pickup & Inspection Fee - Batch ${batch.batchId})`,
          status: 'Completed',
          reference: `PICKUP-FEE-${batch.batchId}`
        }
      ], { session, ordered: true });
      await createNotification({
        userId: batch.farmerId,
        role: 'farmer',
        title: `Batch ${batch.batchId} tested and payment credited`,
        message: `${volume}L passed quality inspection at ₹${ratePerLiter}/L; ₹${totalPrice.toFixed(2)} was credited.`,
        type: 'success',
        session
      });
      await createNotification({
        userId: req.user.id,
        role: 'delivery_agent',
        title: 'Pickup inspection fee credited',
        message: `₹50.00 credited for inspecting batch ${batch.batchId}.`,
        type: 'success',
        session
      });
      return { acceptedBatch, farmer, agent };
    });
    if (payment.accountMissing) {
      return res.status(409).json({ success: false, message: 'The farmer or agent account is unavailable; no payment was made.' });
    }
    if (payment.batchChanged) {
      return res.status(409).json({ success: false, message: 'This batch is no longer awaiting inspection or is assigned to another agent.' });
    }
    const { acceptedBatch, farmer, agent } = payment;
    return res.json({
      success: true,
      message: `Batch ${batch.batchId} accepted and recorded.`,
      batch: acceptedBatch.toObject(),
      batchId: batch.batchId,
      qualityTest: testRecord,
      creditedAmount: totalPrice,
      calculatedRate: ratePerLiter,
      updatedFarmerBalance: farmer.balance,
      updatedAgentBalance: agent.balance
    });
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to complete milk inspection.');
  }
});

router.post('/reject-batch', async (req, res) => {
  try {
    const { pickupId, batchId, reason, remarks, evidencePhoto } = req.body;
    const validReasons = [
      'Low quality reading', 'Abnormal Fat/SNF', 'Abnormal Lactometer Reading',
      'Temperature issue', 'Contamination concern', 'Damaged/unsafe batch', 'Other'
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: `Please select a valid rejection reason: ${validReasons.join(', ')}` });
    }
    const targetId = batchId || pickupId;
    const batch = await MilkBatch.findOne({ batchId: targetId });
    if (!batch) return res.status(404).json({ success: false, message: `Batch ${targetId} not found.` });
    if (batch.status !== 'Collected') {
      return res.status(409).json({ success: false, message: 'This batch is no longer awaiting inspection.' });
    }
    const rejection = {
      reason,
      remarks: remarks || 'Batch rejected during field inspection.',
      agentId: req.user.id,
      agentName: req.user.name,
      rejectedAt: new Date(),
      evidencePhoto: evidencePhoto || '',
      reviewStatus: 'Pending'
    };
    const rejectedBatch = await withMongoTransaction(async session => {
      const updatedBatch = await MilkBatch.findOneAndUpdate({
        batchId: targetId,
        status: 'Collected',
        $or: [{ agentId: req.user.id }, { agentId: '' }, { agentId: null }]
      }, {
        $set: {
          status: 'Rejected',
          agentId: req.user.id,
          agentName: req.user.name,
          rejection
        },
        $push: {
          auditHistory: {
            fromStatus: 'Collected',
            toStatus: 'Rejected',
            changedBy: req.user.name,
            changedById: req.user.id,
            reason: `Rejection: ${reason}`,
            remarks: remarks || ''
          }
        }
      }, { returnDocument: 'after', session });
      if (!updatedBatch) return null;
      const agent = await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { balance: 30 } },
        { returnDocument: 'after', session }
      );
      if (!agent) throw new Error('The delivery agent account is unavailable.');
      await Transaction.create([{
        agentId: req.user.id,
        amount: 30,
        type: `Credit (Inspection Fee - Rejected Batch ${updatedBatch.batchId})`,
        status: 'Completed',
        reference: `REJECTION-FEE-${updatedBatch.batchId}`
      }], { session, ordered: true });
      await createNotification({
        userId: updatedBatch.farmerId,
        role: 'farmer',
        title: `Milk batch ${updatedBatch.batchId} rejected`,
        message: `Reason: ${reason}. ${remarks || 'Payment withheld pending admin review.'}`,
        type: 'warning',
        session
      });
      await createNotification({
        userId: 'admin',
        role: 'admin',
        title: `Rejection review required: ${updatedBatch.batchId}`,
        message: `Batch from ${updatedBatch.farmerName} rejected by ${req.user.name}. Reason: ${reason}.`,
        type: 'warning',
        session
      });
      return updatedBatch;
    });
    if (!rejectedBatch) return res.status(409).json({ success: false, message: 'This batch is no longer awaiting inspection or is assigned to another agent.' });
    return res.json({
      success: true,
      message: `Batch ${rejectedBatch.batchId} rejected and quarantined for review.`,
      batchId: rejectedBatch.batchId,
      rejection: rejectedBatch.rejection,
      batch: rejectedBatch.toObject()
    });
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to process batch rejection.');
  }
});

router.post('/payout', async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid positive withdrawal amount.' });
    }
    const idempotencyKey = getIdempotencyKey(req, req.user.id, 'agent-payout');
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: 'A valid Idempotency-Key header is required.' });
    }
    const requestHash = hashPayload({ amount });
    const previousRequest = await Transaction.findOne({ idempotencyKey });
    if (previousRequest) {
      if (previousRequest.requestHash !== requestHash || previousRequest.agentId !== req.user.id) {
        return res.status(409).json({ success: false, message: 'This request key was already used for a different withdrawal.' });
      }
      const currentAgent = await User.findById(req.user.id).select('balance').lean();
      return res.json({
        success: true,
        message: 'Payout request was already processed.',
        remainingBalance: currentAgent?.balance || 0,
        transaction: { ...previousRequest.toObject(), id: previousRequest._id.toString() }
      });
    }
    const transactionRef = `AGENT-WITHDRAW-${idempotencyKey}`;
    const result = await withMongoTransaction(async session => {
      const agent = await User.findOneAndUpdate(
        { _id: req.user.id, role: { $in: ['agent', 'delivery_agent'] }, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { returnDocument: 'after', session }
      );
      if (!agent) return null;
      const [transaction] = await Transaction.create([{
        agentId: req.user.id,
        amount,
        type: 'Bank Withdrawal',
        status: 'Processing',
        reference: transactionRef,
        idempotencyKey,
        requestHash
      }], { session, ordered: true });
      await createNotification({
        userId: req.user.id,
        role: 'delivery_agent',
        title: 'Agent payout requested',
        message: `Withdrawal of ₹${amount.toFixed(2)} requested to your bank account.`,
        type: 'info',
        session
      });
      return { agent, transaction };
    });
    if (!result) {
      const existing = await User.findById(req.user.id).select('balance').lean();
      if (!existing) return res.status(404).json({ success: false, message: 'Delivery agent account not found.' });
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${(existing.balance || 0).toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
      });
    }
    const { agent, transaction } = result;
    return res.json({
      success: true,
      message: `Payout request of ₹${amount.toFixed(2)} initiated successfully!`,
      remainingBalance: agent.balance,
      transaction
    });
  } catch (error) {
    if (error.code === 11000) {
      const idempotencyKey = getIdempotencyKey(req, req.user.id, 'agent-payout');
      const requestHash = hashPayload({ amount: Number(req.body.amount) });
      const duplicate = await Transaction.findOne({ idempotencyKey });
      if (duplicate?.requestHash === requestHash && duplicate.agentId === req.user.id) {
        const currentAgent = await User.findById(req.user.id).select('balance').lean();
        return res.json({
          success: true,
          message: 'Payout request was already processed.',
          remainingBalance: currentAgent?.balance || 0,
          transaction: { ...duplicate.toObject(), id: duplicate._id.toString() }
        });
      }
    }
    return respondToDatabaseWriteError(res, error, 'Unable to request agent payout.');
  }
});

router.post('/update-status', async (req, res) => {
  try {
    const { taskId, status, type } = req.body;
    if (type === 'farmer_pickup') {
      const previousStatus = status === 'In Transit' ? 'Accepted' : status === 'Delivered' ? 'In Transit' : '';
      if (!previousStatus) {
        return res.status(400).json({ success: false, message: 'Pickup status must follow quality acceptance before transit and delivery.' });
      }
      const batch = await MilkBatch.findOne({ batchId: taskId });
      if (!batch) return res.status(404).json({ success: false, message: 'Pickup not found.' });
      if (batch.agentId && batch.agentId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'This pickup is assigned to another agent.' });
      }
      const updatedBatch = await MilkBatch.findOneAndUpdate({
        batchId: taskId,
        status: previousStatus,
        agentId: req.user.id
      }, {
        $set: { status, agentName: req.user.name },
        $push: {
          auditHistory: {
            fromStatus: previousStatus,
            toStatus: status,
            changedBy: req.user.name,
            changedById: req.user.id,
            reason: `Status updated to ${status}`
          }
        }
      }, { returnDocument: 'after' });
      if (!updatedBatch) return res.status(409).json({ success: false, message: 'Pickup is not in the required status for this transition.' });
      return res.json({ success: true, message: `Pickup status updated to ${status}`, batch: updatedBatch });
    }

    if (type !== 'consumer_delivery') {
      return res.status(400).json({ success: false, message: 'Invalid delivery task type.' });
    }
    const allowed = ['Out for Delivery', 'Delivered'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid delivery status.' });
    const expectedStatus = status === 'Out for Delivery' ? 'Assigned' : 'Out for Delivery';
    const deliverySelector = {
      $or: [{ deliveryId: taskId }, { orderId: taskId }],
      agentId: req.user.id
    };
    const result = await withMongoTransaction(async session => {
      const delivery = await Delivery.findOneAndUpdate({
        ...deliverySelector,
        status: expectedStatus
      }, {
        $set: {
          status,
          ...(status === 'Delivered' ? { deliveredAt: new Date() } : {}),
          ...(status === 'Delivered' ? { commissionPaid: true, commission: 50 } : {})
        },
        $push: {
          tracking: { status, changedAt: new Date(), changedBy: req.user.id }
        }
      }, { returnDocument: 'after', session });
      if (!delivery) return null;

      if (delivery.orderId) {
        const order = await Order.findOneAndUpdate(
          { orderId: delivery.orderId, status: expectedStatus },
          {
            $set: { status },
            $push: { tracking: { status, changedBy: req.user.id } }
          },
          { returnDocument: 'after', session }
        );
        if (!order) throw new Error(`Order ${delivery.orderId} is missing or out of sync with its delivery.`);
      }

      let agent = null;
      if (status === 'Delivered') {
        agent = await User.findByIdAndUpdate(
          req.user.id,
          { $inc: { balance: 50, totalDeliveries: 1 } },
          { returnDocument: 'after', session }
        );
        if (!agent) throw new Error('The delivery agent account is unavailable.');
        await Transaction.create([{
          agentId: req.user.id,
          amount: 50,
          type: 'Credit (Doorstep Delivery Fee)',
          status: 'Completed',
          reference: `DELIVERY-FEE-${delivery.deliveryId}`
        }], { session, ordered: true });
      }
      await createNotification({
        userId: delivery.consumerId,
        role: 'consumer',
        title: `Delivery ${status}`,
        message: `Your delivery ${delivery.deliveryId} is now ${status.toLowerCase()}.`,
        type: status === 'Delivered' ? 'success' : 'info',
        session
      });
      return { delivery, agent };
    });
    if (!result) {
      const exists = await Delivery.exists(deliverySelector);
      return exists
        ? res.status(409).json({ success: false, message: 'Delivery status changed; refresh and try again.' })
        : res.status(404).json({ success: false, message: 'Assigned delivery not found.' });
    }
    const { delivery } = result;
    return res.json({
      success: true,
      message: `Consumer delivery status updated to ${status}`,
      delivery,
      ...(result.agent ? { agentBalance: result.agent.balance } : {})
    });
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to update delivery status.');
  }
});

module.exports = router;

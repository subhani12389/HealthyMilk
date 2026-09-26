const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const { users, milkBatches, transactions, notifications } = require('../store');

// GET /api/admin/dashboard - Complete admin statistics & queues
router.get('/dashboard', async (req, res) => {
  try {
    let allBatches = [];
    if (mongoose.connection.readyState === 1) {
      try {
        allBatches = await MilkBatch.find({}).sort({ collectionDate: -1 }).lean();
      } catch (e) {}
    }

    if (!allBatches || allBatches.length === 0) {
      allBatches = [...milkBatches];
    }

    const totalBatches = allBatches.length;
    const acceptedBatches = allBatches.filter(b => b.status === 'Accepted' || b.status === 'In Transit' || b.status === 'Delivered').length;
    const rejectedBatches = allBatches.filter(b => b.status === 'Rejected').length;
    const inTransitBatches = allBatches.filter(b => b.status === 'In Transit').length;
    const deliveredBatches = allBatches.filter(b => b.status === 'Delivered').length;
    const collectedBatches = allBatches.filter(b => b.status === 'Collected' || b.status === 'Quality Checked').length;

    const totalLitersCollected = allBatches.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);
    const totalPayoutsValue = allBatches
      .filter(b => b.status === 'Accepted' || b.status === 'Delivered' || b.status === 'In Transit')
      .reduce((acc, curr) => acc + (Number(curr.qualityTest?.totalPrice) || 0), 0);

    const rejectedQueue = allBatches.filter(b => b.status === 'Rejected' || b.rejection);

    let dbUsersCount = { farmers: 0, consumers: 0, agents: 0 };
    if (mongoose.connection.readyState === 1) {
      try {
        const farmersCount = await User.countDocuments({ role: 'farmer' });
        const consumersCount = await User.countDocuments({ role: 'consumer' });
        const agentsCount = await User.countDocuments({ role: { $in: ['agent', 'delivery_agent'] } });
        dbUsersCount = { farmers: farmersCount, consumers: consumersCount, agents: agentsCount };
      } catch (e) {
        dbUsersCount = {
          farmers: users.filter(u => u.role === 'farmer').length || 12,
          consumers: users.filter(u => u.role === 'consumer').length || 148,
          agents: users.filter(u => u.role === 'agent' || u.role === 'delivery_agent').length || 8
        };
      }
    } else {
      dbUsersCount = {
        farmers: users.filter(u => u.role === 'farmer').length || 12,
        consumers: users.filter(u => u.role === 'consumer').length || 148,
        agents: users.filter(u => u.role === 'agent' || u.role === 'delivery_agent').length || 8
      };
    }

    return res.json({
      success: true,
      stats: {
        totalBatches,
        acceptedBatches,
        rejectedBatches,
        inTransitBatches,
        deliveredBatches,
        collectedBatches,
        totalLitersCollected,
        totalPayoutsValue,
        usersCount: dbUsersCount
      },
      batches: allBatches,
      rejectedQueue
    });
  } catch (err) {
    console.error('Error fetching admin dashboard:', err);
    return res.status(500).json({ success: false, message: 'Server error loading admin dashboard.' });
  }
});

// POST /api/admin/review-rejection - Review and resolve rejected batch
router.post('/review-rejection', async (req, res) => {
  try {
    const { batchId, decision, adminRemarks, adminName } = req.body;

    const validDecisions = ['Confirmed Rejected', 'Under Review', 'Approved'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ success: false, message: `Invalid decision. Must be one of: ${validDecisions.join(', ')}` });
    }

    let batch = null;
    if (mongoose.connection.readyState === 1) {
      try {
        batch = await MilkBatch.findOne({ batchId });
      } catch (e) {}
    }

    let memBatch = milkBatches.find(b => b.batchId === batchId || b.id === batchId);

    if (!batch && !memBatch) {
      return res.status(404).json({ success: false, message: `Batch ${batchId} not found.` });
    }

    const targetBatch = batch || memBatch;
    const reviewer = adminName || 'Admin Officer';

    // Update rejection review subdocument
    if (!targetBatch.rejection) {
      targetBatch.rejection = {
        reason: 'Other',
        remarks: 'Manual admin inspection',
        agentId: 'system',
        agentName: 'System',
        rejectedAt: new Date()
      };
    }

    targetBatch.rejection.reviewStatus = decision;
    targetBatch.rejection.reviewedBy = reviewer;
    targetBatch.rejection.reviewedAt = new Date();
    targetBatch.rejection.adminRemarks = adminRemarks || '';

    let payoutCredited = 0;

    if (decision === 'Approved') {
      const prevStatus = targetBatch.status;
      targetBatch.status = 'Accepted';
      
      const rate = targetBatch.qualityTest?.ratePerLiter || 45;
      const amount = Math.round(targetBatch.liters * rate);
      payoutCredited = amount;

      if (targetBatch.qualityTest) {
        targetBatch.qualityTest.qualityStatus = 'Passed';
        targetBatch.qualityTest.totalPrice = amount;
      }

      // Credit Farmer balance in DB & memory
      if (mongoose.connection.readyState === 1) {
        try {
          const farmerDoc = await User.findById(targetBatch.farmerId);
          if (farmerDoc) {
            farmerDoc.balance = (farmerDoc.balance || 0) + amount;
            await farmerDoc.save();
          }
        } catch (e) {}
      }

      const farmerMem = users.find(u => u.id === targetBatch.farmerId || u._id === targetBatch.farmerId);
      if (farmerMem) {
        farmerMem.balance = (farmerMem.balance || 0) + amount;
      }

      // Add transaction
      transactions.unshift({
        id: `tx_${Date.now()}`,
        farmerId: targetBatch.farmerId,
        amount,
        type: `Credit (Admin Approved Batch ${batchId})`,
        date: new Date().toLocaleDateString(),
        status: 'Completed',
        reference: `ADM-${Math.floor(1000 + Math.random() * 9000)}-${batchId}`
      });

      // Notify Farmer
      notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: targetBatch.farmerId,
        title: `Batch ${batchId} Approved by Admin!`,
        message: `Admin reviewed batch ${batchId} and approved payout. ₹${amount.toFixed(2)} has been credited to your balance. Note: ${adminRemarks || 'Quality variance approved.'}`,
        time: 'Just now',
        read: false,
        type: 'success'
      });

      if (batch && batch.addAuditLog) {
        batch.addAuditLog(prevStatus, 'Accepted', reviewer, 'admin_1', `Admin approved rejection: ${decision}`, adminRemarks);
      }
      if (memBatch) {
        if (!memBatch.auditHistory) memBatch.auditHistory = [];
        memBatch.auditHistory.unshift({
          fromStatus: prevStatus,
          toStatus: 'Accepted',
          changedBy: reviewer,
          changedById: 'admin_1',
          changedAt: new Date().toISOString(),
          reason: `Admin review resolution: ${decision}`,
          remarks: adminRemarks || 'Payout approved and released to farmer'
        });
      }
    } else {
      // Notify Farmer of status update
      notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: targetBatch.farmerId,
        title: `Batch ${batchId} Rejection Review: ${decision}`,
        message: `Admin has marked rejected batch ${batchId} as "${decision}". Remarks: ${adminRemarks || 'Under investigation.'}`,
        time: 'Just now',
        read: false,
        type: decision === 'Confirmed Rejected' ? 'warning' : 'info'
      });

      if (batch && batch.addAuditLog) {
        batch.addAuditLog('Rejected', 'Rejected', reviewer, 'admin_1', `Admin review updated to ${decision}`, adminRemarks);
      }
      if (memBatch) {
        if (!memBatch.auditHistory) memBatch.auditHistory = [];
        memBatch.auditHistory.unshift({
          fromStatus: 'Rejected',
          toStatus: 'Rejected',
          changedBy: reviewer,
          changedById: 'admin_1',
          changedAt: new Date().toISOString(),
          reason: `Admin review status: ${decision}`,
          remarks: adminRemarks || ''
        });
      }
    }

    if (batch) {
      await batch.save();
    }

    return res.json({
      success: true,
      message: `Batch ${batchId} review status updated to "${decision}"! ${payoutCredited > 0 ? `₹${payoutCredited} credited to farmer.` : ''}`,
      batch: targetBatch,
      payoutCredited
    });
  } catch (err) {
    console.error('Error reviewing batch rejection:', err);
    return res.status(500).json({ success: false, message: 'Server error processing admin review.' });
  }
});

module.exports = router;

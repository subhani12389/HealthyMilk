const express = require('express');
const router = express.Router();
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const { deliveryTasks, milkLogs, milkBatches, users, transactions, notifications } = require('../store');

// GET /api/delivery/dashboard?agentId=
router.get('/dashboard', async (req, res) => {
  const { agentId } = req.query;
  let agent = users.find(u => u.id === agentId && (u.role === 'agent' || u.role === 'delivery_agent'));
  if (!agent) {
    agent = users.find(u => u.role === 'agent' || u.role === 'delivery_agent');
  }

  // Fetch batches for this agent or all active collection batches
  let batches = [];
  try {
    batches = await MilkBatch.find({}).sort({ collectionDate: -1 }).lean();
  } catch (e) {}

  if (!batches || batches.length === 0) {
    batches = [...milkBatches];
  }

  if (!agent) {
    return res.json({
      success: true,
      agent: {
        id: 'new_agent',
        name: 'Delivery Agent',
        email: 'agent@example.com',
        assignedArea: 'Sector 14 & Green Valley',
        vehicleNo: 'GJ-07-MK-4421',
        balance: 0,
        totalDeliveries: 0,
        bankDetails: { accountNo: 'XXXX-XXXX-3341', ifsc: 'HDFC0001290', bankName: 'HDFC Bank' }
      },
      transactions: [],
      farmerPickups: batches.map(b => ({
        id: b.id || b.batchId,
        batchId: b.batchId,
        farmerId: b.farmerId,
        farmerName: b.farmName || b.farmerName,
        liters: b.liters,
        status: b.status,
        dateStr: new Date(b.collectionDate).toLocaleDateString() + ' ' + new Date(b.collectionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: b.notes,
        qualityTest: b.qualityTest,
        rejection: b.rejection
      })),
      consumerDeliveries: deliveryTasks,
      batches
    });
  }

  const agentTxs = transactions.filter(t => t.agentId === agent.id);

  return res.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      assignedArea: agent.assignedArea || 'Sector 14 & Green Valley',
      vehicleNo: agent.vehicleNo || 'GJ-07-MK-4421',
      balance: agent.balance || 0,
      totalDeliveries: agent.totalDeliveries || 0,
      bankDetails: agent.bankDetails || { accountNo: 'XXXX-XXXX-3341', ifsc: 'HDFC0001290', bankName: 'HDFC Bank' }
    },
    transactions: agentTxs,
    farmerPickups: batches.map(b => ({
      id: b.id || b.batchId,
      batchId: b.batchId,
      farmerId: b.farmerId,
      farmerName: b.farmName || b.farmerName,
      liters: b.liters,
      status: b.status,
      dateStr: new Date(b.collectionDate).toLocaleDateString() + ' ' + new Date(b.collectionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: b.notes,
      qualityTest: b.qualityTest,
      rejection: b.rejection
    })),
    consumerDeliveries: deliveryTasks,
    batches
  });
});

// GET /api/delivery/tasks
router.get('/tasks', async (req, res) => {
  let batches = [];
  try {
    batches = await MilkBatch.find({}).sort({ collectionDate: -1 }).lean();
  } catch (e) {}

  if (!batches || batches.length === 0) {
    batches = [...milkBatches];
  }

  return res.json({
    success: true,
    farmerPickups: batches,
    consumerDeliveries: deliveryTasks
  });
});

// POST /api/delivery/test-and-collect - Quality test, credit Farmer milk money & credit Agent delivery fee
router.post('/test-and-collect', async (req, res) => {
  const { pickupId, batchId, testedFat, testedSNF, lactometerReading, temperature, liters, agentName, agentId, remarks } = req.body;

  const targetId = batchId || pickupId;
  let batchDoc = null;
  try {
    batchDoc = await MilkBatch.findOne({
      $or: [
        { batchId: targetId },
        { id: targetId }
      ]
    });
  } catch (e) {}

  let memBatch = milkBatches.find(b => b.batchId === targetId || b.id === targetId);

  const fat = parseFloat(testedFat);
  const snf = parseFloat(testedSNF);
  const lacto = parseFloat(lactometerReading) || 29.5;
  const temp = parseFloat(temperature) !== undefined && !isNaN(parseFloat(temperature)) ? parseFloat(temperature) : 4.0;
  const vol = parseFloat(liters) || (batchDoc ? batchDoc.liters : (memBatch ? memBatch.liters : 25));

  // Validation
  if (isNaN(fat) || fat < 0.5 || fat > 15.0) {
    return res.status(400).json({ success: false, message: 'Invalid Fat %. Must be between 0.5% and 15.0%.' });
  }
  if (isNaN(snf) || snf < 4.0 || snf > 15.0) {
    return res.status(400).json({ success: false, message: 'Invalid SNF %. Must be between 4.0% and 15.0%.' });
  }
  if (isNaN(lacto) || lacto < 15.0 || lacto > 38.0) {
    return res.status(400).json({ success: false, message: 'Invalid Lactometer reading. Must be between 15.0 and 38.0.' });
  }
  if (isNaN(temp) || temp < -2.0 || temp > 45.0) {
    return res.status(400).json({ success: false, message: 'Invalid Temperature. Must be between -2°C and 45°C.' });
  }

  // Dynamic Rate per Liter based on Fat & SNF
  const baseRate = 45;
  const fatDiff = fat - 3.5;
  const snfDiff = snf - 8.5;
  const ratePerLiter = Math.max(35, Math.round(baseRate + (fatDiff * 6) + (snfDiff * 4)));
  const totalPrice = Math.round(vol * ratePerLiter);
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
    testedBy: agentName || 'Delivery Agent',
    testedById: agentId || 'agent_1',
    remarks: remarks || 'Optimal quality tested on-site'
  };

  const actualBatchId = batchDoc ? batchDoc.batchId : (memBatch ? memBatch.batchId : `HM-${Date.now()}`);
  const farmerId = batchDoc ? batchDoc.farmerId : (memBatch ? memBatch.farmerId : 'farmer_1');

  // Update DB Batch
  if (batchDoc) {
    const prevStatus = batchDoc.status;
    batchDoc.liters = vol;
    batchDoc.status = 'Accepted';
    batchDoc.qualityTest = testRecord;
    if (!batchDoc.qualityHistory) batchDoc.qualityHistory = [];
    batchDoc.qualityHistory.push(testRecord);
    batchDoc.agentId = agentId || batchDoc.agentId;
    batchDoc.agentName = agentName || batchDoc.agentName;
    batchDoc.addAuditLog(prevStatus, 'Accepted', agentName || 'Delivery Agent', agentId || 'agent_1', 'Quality test passed & accepted', remarks || '');
    await batchDoc.save();
  }

  // Update Memory Batch
  if (memBatch) {
    const prevStatus = memBatch.status;
    memBatch.liters = vol;
    memBatch.status = 'Accepted';
    memBatch.qualityTest = testRecord;
    if (!memBatch.qualityHistory) memBatch.qualityHistory = [];
    memBatch.qualityHistory.push(testRecord);
    memBatch.agentId = agentId || memBatch.agentId;
    memBatch.agentName = agentName || memBatch.agentName;
    if (!memBatch.auditHistory) memBatch.auditHistory = [];
    memBatch.auditHistory.unshift({
      fromStatus: prevStatus,
      toStatus: 'Accepted',
      changedBy: agentName || 'Delivery Agent',
      changedById: agentId || 'agent_1',
      changedAt: new Date().toISOString(),
      reason: 'Quality test passed & accepted',
      remarks: remarks || ''
    });
  }

  // Also update milkLogs for backward compatibility
  const log = milkLogs.find(l => l.id === targetId || l.batchId === targetId);
  if (log) {
    log.fatPercentage = fat;
    log.snfPercentage = snf;
    log.lactometerReading = lacto;
    log.temperature = temp;
    log.ratePerLiter = ratePerLiter;
    log.totalPrice = totalPrice;
    log.qualityScore = qualityScore;
    log.status = 'Tested & Picked Up by Agent';
    log.agentName = agentName || 'Delivery Agent';
  }

  // Credit Farmer Account Balance
  try {
    const farmerDoc = await User.findById(farmerId);
    if (farmerDoc) {
      farmerDoc.balance = (farmerDoc.balance || 0) + totalPrice;
      await farmerDoc.save();
    }
  } catch (e) {}

  const farmer = users.find(u => u.id === farmerId || u._id === farmerId);
  if (farmer) {
    farmer.balance = (farmer.balance || 0) + totalPrice;
  }

  transactions.unshift({
    id: `tx_${Date.now()}`,
    farmerId,
    amount: totalPrice,
    type: `Credit (Batch ${actualBatchId} - Verified by Agent)`,
    date: new Date().toLocaleDateString(),
    status: 'Completed',
    reference: `DEP-${Math.floor(1000 + Math.random() * 9000)}-${actualBatchId}`
  });

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: farmerId,
    title: `Batch ${actualBatchId} Tested & Money Credited!`,
    message: `Delivery Agent tested your ${vol}L batch (Fat: ${fat}%, SNF: ${snf}%, Temp: ${temp}°C). Rate: ₹${ratePerLiter}/L. ₹${totalPrice.toFixed(2)} credited to your balance! Quality Score: ${qualityScore}/100 (${qualityStatus}).`,
    time: 'Just now',
    read: false,
    type: 'success'
  });

  // Credit Delivery Agent Fee (₹50 per verified collection)
  const agent = users.find(u => u.id === agentId || u.role === 'agent' || u.role === 'delivery_agent');
  if (agent) {
    agent.balance = (agent.balance || 0) + 50;
    agent.totalDeliveries = (agent.totalDeliveries || 0) + 1;

    transactions.unshift({
      id: `tx_${Date.now()}`,
      agentId: agent.id,
      amount: 50,
      type: `Credit (Pickup & Inspection Fee - Batch ${actualBatchId})`,
      date: new Date().toLocaleDateString(),
      status: 'Completed',
      reference: `AG-${Math.floor(1000 + Math.random() * 9000)}`
    });

    notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: agent.id,
      title: 'Delivery Fee Credited',
      message: `₹50.00 collection fee added to your balance for inspecting Batch ${actualBatchId}.`,
      time: 'Just now',
      read: false,
      type: 'success'
    });
  }

  return res.json({
    success: true,
    message: `Batch ${actualBatchId} verified (Fat: ${fat}%, SNF: ${snf}%, Temp: ${temp}°C). Rate: ₹${ratePerLiter}/L. ₹${totalPrice.toFixed(2)} credited to Farmer! Agent fee ₹50 credited.`,
    batch: batchDoc || memBatch,
    batchId: actualBatchId,
    qualityTest: testRecord,
    creditedAmount: totalPrice,
    calculatedRate: ratePerLiter,
    updatedFarmerBalance: farmer ? farmer.balance : null,
    updatedAgentBalance: agent ? agent.balance : null
  });
});

// POST /api/delivery/reject-batch - Delivery Agent rejects batch with reason, remarks, evidence
router.post('/reject-batch', async (req, res) => {
  try {
    const { pickupId, batchId, reason, remarks, evidencePhoto, agentName, agentId } = req.body;

    const validReasons = [
      'Low quality reading',
      'Abnormal Fat/SNF',
      'Abnormal Lactometer Reading',
      'Temperature issue',
      'Contamination concern',
      'Damaged/unsafe batch',
      'Other'
    ];

    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid rejection reason: ${validReasons.join(', ')}`
      });
    }

    const targetId = batchId || pickupId;
    let batchDoc = null;
    try {
      batchDoc = await MilkBatch.findOne({
        $or: [
          { batchId: targetId },
          { id: targetId }
        ]
      });
    } catch (e) {}

    let memBatch = milkBatches.find(b => b.batchId === targetId || b.id === targetId);

    if (!batchDoc && !memBatch) {
      return res.status(404).json({ success: false, message: `Batch ${targetId} not found.` });
    }

    const actualBatchId = batchDoc ? batchDoc.batchId : memBatch.batchId;
    const farmerId = batchDoc ? batchDoc.farmerId : memBatch.farmerId;
    const farmerName = batchDoc ? batchDoc.farmerName : memBatch.farmerName;

    const rejectionData = {
      reason,
      remarks: remarks || 'Batch rejected during field inspection.',
      agentId: agentId || 'agent_1',
      agentName: agentName || 'Delivery Agent',
      rejectedAt: new Date(),
      evidencePhoto: evidencePhoto || '',
      reviewStatus: 'Pending'
    };

    // Update DB Batch
    if (batchDoc) {
      const prevStatus = batchDoc.status;
      batchDoc.status = 'Rejected';
      batchDoc.rejection = rejectionData;
      batchDoc.addAuditLog(prevStatus, 'Rejected', agentName || 'Delivery Agent', agentId || 'agent_1', `Rejection: ${reason}`, remarks || '');
      await batchDoc.save();
    }

    // Update Memory Batch
    if (memBatch) {
      const prevStatus = memBatch.status;
      memBatch.status = 'Rejected';
      memBatch.rejection = rejectionData;
      if (!memBatch.auditHistory) memBatch.auditHistory = [];
      memBatch.auditHistory.unshift({
        fromStatus: prevStatus,
        toStatus: 'Rejected',
        changedBy: agentName || 'Delivery Agent',
        changedById: agentId || 'agent_1',
        changedAt: new Date().toISOString(),
        reason: `Rejection: ${reason}`,
        remarks: remarks || ''
      });
    }

    // Update milkLogs
    const log = milkLogs.find(l => l.id === targetId || l.batchId === targetId);
    if (log) {
      log.status = 'Rejected by Delivery Agent';
    }

    // IMPORTANT: Normal farmer milk payout is NOT credited for rejected batch!

    // Credit inspection fee to Agent (₹30 for conducting test)
    const agent = users.find(u => u.id === agentId || u.role === 'agent' || u.role === 'delivery_agent');
    if (agent) {
      agent.balance = (agent.balance || 0) + 30;
      transactions.unshift({
        id: `tx_${Date.now()}`,
        agentId: agent.id,
        amount: 30,
        type: `Credit (Inspection Fee - Rejected Batch ${actualBatchId})`,
        date: new Date().toLocaleDateString(),
        status: 'Completed',
        reference: `REJ-AG-${Math.floor(1000 + Math.random() * 9000)}`
      });
    }

    // Notify Farmer of Rejection with full details
    notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: farmerId,
      title: `⚠️ Milk Batch ${actualBatchId} Rejected`,
      message: `Your milk batch ${actualBatchId} was rejected during inspection. Reason: "${reason}". Remarks: ${remarks || 'Standards check failed.'}. Payment withheld pending admin review.`,
      time: 'Just now',
      read: false,
      type: 'warning'
    });

    // Notify Admin Queue
    notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: 'admin',
      title: `🚨 Rejection Alert: Batch ${actualBatchId}`,
      message: `Batch ${actualBatchId} from ${farmerName} rejected by ${agentName || 'Agent'}. Reason: ${reason}. Awaiting admin review.`,
      time: 'Just now',
      read: false,
      type: 'warning'
    });

    return res.json({
      success: true,
      message: `Batch ${actualBatchId} marked as Rejected. Reason: ${reason}. Farmer notified and batch quarantined.`,
      batchId: actualBatchId,
      rejection: rejectionData,
      batch: batchDoc || memBatch
    });
  } catch (err) {
    console.error('Error rejecting batch:', err);
    return res.status(500).json({ success: false, message: 'Server error processing batch rejection.' });
  }
});

// POST /api/delivery/payout - Delivery Agent bank withdrawal
router.post('/payout', (req, res) => {
  const { agentId, amount } = req.body;
  const agent = users.find(u => u.id === agentId) || users.find(u => u.role === 'agent' || u.role === 'delivery_agent');

  if (!agent) return res.status(404).json({ success: false, message: 'Delivery Agent not found.' });

  const payoutAmt = parseFloat(amount) || agent.balance;

  if (payoutAmt <= 0 || payoutAmt > (agent.balance || 0)) {
    return res.status(400).json({ success: false, message: 'Invalid withdrawal amount or insufficient balance.' });
  }

  agent.balance = (agent.balance || 0) - payoutAmt;

  const newTx = {
    id: `tx_${Date.now()}`,
    agentId: agent.id,
    amount: payoutAmt,
    type: 'Bank Withdrawal',
    date: new Date().toLocaleDateString(),
    status: 'Processing',
    reference: `WTH-AG-${Math.floor(1000 + Math.random() * 9000)}`
  };

  transactions.unshift(newTx);

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: agent.id,
    title: 'Agent Payout Requested',
    message: `Withdrawal of ₹${payoutAmt.toFixed(2)} requested to bank account.`,
    time: 'Just now',
    read: false,
    type: 'info'
  });

  return res.json({
    success: true,
    message: `Payout request of ₹${payoutAmt.toFixed(2)} initiated successfully!`,
    remainingBalance: agent.balance,
    transaction: newTx
  });
});

// POST /api/delivery/update-status
router.post('/update-status', async (req, res) => {
  const { taskId, status, type, agentId } = req.body;

  if (type === 'farmer_pickup') {
    let batchDoc = null;
    try {
      batchDoc = await MilkBatch.findOne({ $or: [{ batchId: taskId }, { id: taskId }] });
      if (batchDoc) {
        const prev = batchDoc.status;
        batchDoc.status = status;
        batchDoc.addAuditLog(prev, status, 'Delivery Agent', agentId, `Status updated to ${status}`);
        await batchDoc.save();
      }
    } catch (e) {}

    const mem = milkBatches.find(b => b.batchId === taskId || b.id === taskId);
    if (mem) {
      const prev = mem.status;
      mem.status = status;
      if (!mem.auditHistory) mem.auditHistory = [];
      mem.auditHistory.unshift({
        fromStatus: prev,
        toStatus: status,
        changedBy: 'Delivery Agent',
        changedById: agentId,
        changedAt: new Date().toISOString(),
        reason: `Status updated to ${status}`,
        remarks: ''
      });
    }

    const log = milkLogs.find(l => l.id === taskId || l.batchId === taskId);
    if (log) {
      log.status = status;
    }

    return res.json({ success: true, message: `Farmer pickup status updated to ${status}`, batch: batchDoc || mem });
  } else {
    const task = deliveryTasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      
      const agent = users.find(u => u.id === agentId || u.role === 'agent' || u.role === 'delivery_agent');
      if (agent && status === 'Delivered') {
        agent.balance = (agent.balance || 0) + 50;
        agent.totalDeliveries = (agent.totalDeliveries || 0) + 1;
        transactions.unshift({
          id: `tx_${Date.now()}`,
          agentId: agent.id,
          amount: 50,
          type: 'Credit (Doorstep Delivery Fee)',
          date: new Date().toLocaleDateString(),
          status: 'Completed',
          reference: `DEL-${Math.floor(1000 + Math.random() * 9000)}`
        });
      }

      return res.json({ success: true, message: `Consumer delivery status updated to ${status}`, task });
    }
  }

  return res.status(404).json({ success: false, message: 'Task not found.' });
});

module.exports = router;

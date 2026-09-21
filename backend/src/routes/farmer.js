const express = require('express');
const router = express.Router();
const MilkBatch = require('../models/MilkBatch');
const { users, milkLogs, milkBatches, generateBatchId, transactions, notifications } = require('../store');

// GET /api/farmer/dashboard?farmerId=
router.get('/dashboard', async (req, res) => {
  const { farmerId } = req.query;
  let farmer = users.find(u => u.id === farmerId && (u.role === 'farmer' || u.role === 'farmer_1'));
  
  if (!farmer) {
    farmer = users.find(u => u.role === 'farmer');
  }

  // Fetch batches for this farmer
  let batches = [];
  try {
    if (farmer) {
      batches = await MilkBatch.find({
        $or: [
          { farmerId: farmer.id },
          { farmerId: farmer._id ? farmer._id.toString() : farmer.id }
        ]
      }).sort({ collectionDate: -1 }).lean();
    }
  } catch (e) {}

  if (!batches || batches.length === 0) {
    const fId = farmer ? farmer.id : (farmerId || 'farmer_1');
    batches = milkBatches.filter(b => b.farmerId === fId || b.farmerId === 'farmer_1');
  }

  if (!farmer) {
    return res.json({
      success: true,
      farmer: {
        id: 'new_farmer',
        name: 'New Farmer',
        farmName: 'My Organic Dairy Farm',
        location: 'Kaira Valley, Anand',
        balance: 0,
        rating: 5.0,
        cattleCount: 10,
        bankDetails: { accountNo: 'XXXX-XXXX-8921', ifsc: 'SBIN0004123', bankName: 'State Bank of India' }
      },
      currentMilkStatus: null,
      batches: batches || [],
      rejectedBatches: (batches || []).filter(b => b.status === 'Rejected'),
      stats: {
        totalLitersAllTime: 0,
        totalEarningsAllTime: 0,
        pendingPayout: 0,
        logsCount: (batches || []).length,
        acceptedCount: (batches || []).filter(b => b.status === 'Accepted').length,
        rejectedCount: (batches || []).filter(b => b.status === 'Rejected').length
      }
    });
  }

  const logs = milkLogs.filter(l => l.farmerId === farmer.id);
  const todayBatch = batches[0] || null;
  const todayLog = logs[0] || null;

  const totalLitersAllTime = batches
    .filter(b => b.status === 'Accepted' || b.status === 'In Transit' || b.status === 'Delivered')
    .reduce((acc, curr) => acc + curr.liters, 0);

  const totalEarningsAllTime = batches
    .filter(b => b.status === 'Accepted' || b.status === 'In Transit' || b.status === 'Delivered')
    .reduce((acc, curr) => acc + (curr.qualityTest?.totalPrice || curr.totalPrice || 0), 0);

  const rejectedBatches = batches.filter(b => b.status === 'Rejected');

  return res.json({
    success: true,
    farmer: {
      id: farmer.id,
      name: farmer.name,
      farmName: farmer.farmName,
      location: farmer.location,
      balance: farmer.balance || 0,
      rating: farmer.rating || 5.0,
      cattleCount: farmer.cattleCount || 10,
      bankDetails: farmer.bankDetails || { accountNo: 'XXXX-XXXX-8921', ifsc: 'SBIN0004123', bankName: 'State Bank of India' }
    },
    batches,
    rejectedBatches,
    currentMilkStatus: todayBatch ? {
      id: todayBatch.id || todayBatch.batchId,
      batchId: todayBatch.batchId,
      liters: todayBatch.liters,
      fatPercentage: todayBatch.qualityTest?.fatPercentage || todayBatch.fatPercentage || 0,
      snfPercentage: todayBatch.qualityTest?.snfPercentage || todayBatch.snfPercentage || 0,
      lactometerReading: todayBatch.qualityTest?.lactometerReading || todayBatch.lactometerReading || 0,
      temperature: todayBatch.qualityTest?.temperature || 4.0,
      ratePerLiter: todayBatch.qualityTest?.ratePerLiter || todayBatch.ratePerLiter || 0,
      totalPrice: todayBatch.qualityTest?.totalPrice || todayBatch.totalPrice || 0,
      qualityScore: todayBatch.qualityTest?.qualityScore || todayBatch.qualityScore || 0,
      qualityStatus: todayBatch.qualityTest?.qualityStatus || 'Pending',
      status: todayBatch.status,
      timestamp: todayBatch.collectionDate,
      dateStr: new Date(todayBatch.collectionDate).toLocaleDateString() + ' ' + new Date(todayBatch.collectionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      agentName: todayBatch.agentName,
      rejection: todayBatch.rejection || null
    } : (todayLog ? {
      id: todayLog.id,
      batchId: todayLog.batchId || 'HM-20260921-0001',
      liters: todayLog.liters,
      fatPercentage: todayLog.fatPercentage,
      snfPercentage: todayLog.snfPercentage,
      ratePerLiter: todayLog.ratePerLiter,
      totalPrice: todayLog.totalPrice,
      qualityScore: todayLog.qualityScore,
      status: todayLog.status,
      timestamp: todayLog.timestamp,
      dateStr: todayLog.dateStr,
      agentName: todayLog.agentName
    } : null),
    stats: {
      totalLitersAllTime,
      totalEarningsAllTime,
      pendingPayout: farmer.balance || 0,
      logsCount: batches.length,
      acceptedCount: batches.filter(b => b.status === 'Accepted' || b.status === 'Delivered').length,
      rejectedCount: rejectedBatches.length
    }
  });
});

// POST /api/farmer/request-pickup - Farmer requests milk pickup & creates Milk Batch ID
router.post('/request-pickup', async (req, res) => {
  const { farmerId, liters, notes } = req.body;

  let farmer = users.find(u => u.id === farmerId);
  if (!farmer) {
    farmer = users.find(u => u.role === 'farmer') || { id: farmerId || 'farmer_1', name: 'Farmer', farmName: 'Organic Dairy Farm', balance: 0 };
  }

  const vol = parseFloat(liters);
  if (!vol || vol <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid milk volume in Liters.' });
  }

  const newBatchId = generateBatchId();

  // Create new MilkBatch Document
  const batchData = {
    id: `batch_${Date.now()}`,
    batchId: newBatchId,
    farmerId: farmer.id,
    farmerName: farmer.name || 'Dairy Farmer',
    farmName: farmer.farmName || 'Organic Farm',
    farmLocation: farmer.location || 'Kaira Valley, Anand',
    agentId: 'agent_1',
    agentName: 'Assigned Delivery Agent',
    liters: vol,
    status: 'Collected',
    collectionDate: new Date().toISOString(),
    notes: notes || 'Morning collection batch',
    qualityTest: null,
    qualityHistory: [],
    rejection: null,
    auditHistory: [
      {
        fromStatus: 'None',
        toStatus: 'Collected',
        changedBy: farmer.name || 'Farmer',
        changedById: farmer.id,
        changedAt: new Date().toISOString(),
        reason: 'Farmer logged collection pickup request',
        remarks: `Unique Batch ID assigned: ${newBatchId}`
      }
    ]
  };

  try {
    const batchDoc = new MilkBatch(batchData);
    await batchDoc.save();
  } catch (e) {
    console.warn('DB Batch save note:', e.message);
  }

  milkBatches.unshift(batchData);

  const newRequest = {
    id: `log_${Date.now()}`,
    batchId: newBatchId,
    farmerId: farmer.id,
    farmerName: farmer.farmName || farmer.name,
    liters: vol,
    fatPercentage: 0,
    snfPercentage: 0,
    lactometerReading: 0,
    temperature: 4.0,
    ratePerLiter: 0,
    totalPrice: 0,
    timestamp: new Date().toISOString(),
    dateStr: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'Collection Requested (Awaiting Agent Inspection)',
    agentName: 'Assigned Agent',
    notes: notes || 'Fresh morning batch ready for testing',
    qualityScore: 0
  };

  milkLogs.unshift(newRequest);

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: farmer.id,
    title: `Milk Batch ${newBatchId} Created`,
    message: `Collection request for ${vol}L logged with Batch ID ${newBatchId}. Delivery Agent will arrive shortly to perform quality testing.`,
    time: 'Just now',
    read: false,
    type: 'info'
  });

  return res.json({
    success: true,
    message: `Milk Batch ${newBatchId} for ${vol} Liters registered successfully! Awaiting Delivery Agent inspection.`,
    batch: batchData,
    batchId: newBatchId,
    request: newRequest
  });
});

// GET /api/farmer/history
router.get('/history', async (req, res) => {
  const { farmerId } = req.query;
  let batches = [];
  try {
    if (farmerId) {
      batches = await MilkBatch.find({ farmerId }).sort({ collectionDate: -1 }).lean();
    } else {
      batches = await MilkBatch.find({}).sort({ collectionDate: -1 }).lean();
    }
  } catch (e) {}

  if (!batches || batches.length === 0) {
    batches = farmerId ? milkBatches.filter(b => b.farmerId === farmerId) : milkBatches;
  }

  const logs = farmerId ? milkLogs.filter(l => l.farmerId === farmerId) : milkLogs;
  const txs = farmerId ? transactions.filter(t => t.farmerId === farmerId) : transactions;

  return res.json({
    success: true,
    batches,
    logs,
    transactions: txs
  });
});

// POST /api/farmer/payout
router.post('/payout', (req, res) => {
  const { farmerId, amount } = req.body;
  const farmer = users.find(u => u.id === farmerId) || users.find(u => u.role === 'farmer');

  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });

  const payoutAmt = parseFloat(amount) || farmer.balance;

  if (payoutAmt <= 0 || payoutAmt > (farmer.balance || 0)) {
    return res.status(400).json({ success: false, message: 'Invalid withdrawal amount or insufficient balance.' });
  }

  farmer.balance = (farmer.balance || 0) - payoutAmt;

  const newTx = {
    id: `tx_${Date.now()}`,
    farmerId: farmer.id,
    amount: payoutAmt,
    type: 'Bank Withdrawal',
    date: new Date().toLocaleDateString(),
    status: 'Processing',
    reference: `WTH-${Math.floor(1000 + Math.random() * 9000)}-${farmer.bankDetails?.bankName?.slice(0, 3)?.toUpperCase() || 'SBI'}`
  };

  transactions.unshift(newTx);

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: farmer.id,
    title: 'Payout Initiated',
    message: `Withdrawal of ₹${payoutAmt.toFixed(2)} requested to bank account.`,
    time: 'Just now',
    read: false,
    type: 'info'
  });

  return res.json({
    success: true,
    message: `Payout request of ₹${payoutAmt.toFixed(2)} initiated successfully!`,
    remainingBalance: farmer.balance,
    transaction: newTx
  });
});

// PUT /api/farmer/settings
router.put('/settings', (req, res) => {
  const { farmerId, farmName, location, cattleCount, bankDetails } = req.body;
  const farmer = users.find(u => u.id === farmerId) || users.find(u => u.role === 'farmer');

  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });

  if (farmName) farmer.farmName = farmName;
  if (location) farmer.location = location;
  if (cattleCount) farmer.cattleCount = parseInt(cattleCount);
  if (bankDetails) farmer.bankDetails = { ...farmer.bankDetails, ...bankDetails };

  return res.json({
    success: true,
    message: 'Farmer profile & settings updated successfully!',
    farmer
  });
});

module.exports = router;

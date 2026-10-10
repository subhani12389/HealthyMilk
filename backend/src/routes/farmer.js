const express = require('express');
const router = express.Router();
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { generateBatchId } = require('../utils/batchId');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { createNotification } = require('../services/notificationService');
const { getPagination, paginationResult } = require('../utils/pagination');
const { getIdempotencyKey, hashPayload } = require('../utils/idempotency');
const { withMongoTransaction, respondToDatabaseWriteError } = require('../config/db');

router.use(verifyToken, requireRole(['farmer']));

// GET /api/farmer/dashboard?farmerId=
router.get('/dashboard', async (req, res) => {
  try {
    const farmer = await User.findOne({ _id: req.user.id, role: 'farmer' }).lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });

    const { page, limit, skip } = getPagination(req.query);
    const batchFilter = { farmerId: farmer._id.toString() };
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      batchFilter.$or = ['batchId', 'status', 'notes'].map(field => ({ [field]: expression }));
    }
    const [batches, totalItems, summary] = await Promise.all([
      MilkBatch.find(batchFilter)
      .sort({ collectionDate: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
      MilkBatch.countDocuments(batchFilter),
      MilkBatch.aggregate([
        { $match: { farmerId: farmer._id.toString() } },
        { $group: {
          _id: null,
          totalLitersAllTime: { $sum: { $cond: [{ $in: ['$status', ['Accepted', 'In Transit', 'Delivered']] }, '$liters', 0] } },
          totalEarningsAllTime: { $sum: { $cond: [{ $in: ['$status', ['Accepted', 'In Transit', 'Delivered']] }, { $ifNull: ['$qualityTest.totalPrice', 0] }, 0] } },
          acceptedCount: { $sum: { $cond: [{ $in: ['$status', ['Accepted', 'Delivered']] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } }
        } }
      ])
    ]);
    const statsSummary = summary[0] || { totalLitersAllTime: 0, totalEarningsAllTime: 0, acceptedCount: 0, rejectedCount: 0 };
    const rejectedBatches = batches.filter(batch => batch.status === 'Rejected');
    const todayBatch = batches[0] || null;
    const balance = farmer.balance || 0;

    return res.json({
      success: true,
      farmer: {
        id: farmer._id.toString(),
        name: farmer.name,
        farmName: farmer.farmName,
        location: farmer.location,
        balance,
        rating: farmer.rating || 5.0,
        cattleCount: farmer.cattleCount || 10,
        bankDetails: farmer.bankDetails
      },
      batches,
      rejectedBatches,
      currentMilkStatus: todayBatch ? {
        id: todayBatch._id.toString(),
        batchId: todayBatch.batchId,
        liters: todayBatch.liters,
        fatPercentage: todayBatch.qualityTest?.fatPercentage || 0,
        snfPercentage: todayBatch.qualityTest?.snfPercentage || 0,
        lactometerReading: todayBatch.qualityTest?.lactometerReading || 0,
        temperature: todayBatch.qualityTest?.temperature || 4.0,
        ratePerLiter: todayBatch.qualityTest?.ratePerLiter || 0,
        totalPrice: todayBatch.qualityTest?.totalPrice || 0,
        qualityScore: todayBatch.qualityTest?.qualityScore || 0,
        qualityStatus: todayBatch.qualityTest?.qualityStatus || 'Pending',
        status: todayBatch.status,
        timestamp: todayBatch.collectionDate,
        dateStr: new Date(todayBatch.collectionDate).toLocaleDateString() + ' ' + new Date(todayBatch.collectionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentName: todayBatch.agentName,
        rejection: todayBatch.rejection || null
      } : null,
      stats: {
        totalLitersAllTime: statsSummary.totalLitersAllTime,
        totalEarningsAllTime: statsSummary.totalEarningsAllTime,
        pendingPayout: balance,
        logsCount: totalItems,
        acceptedCount: statsSummary.acceptedCount,
        rejectedCount: statsSummary.rejectedCount
      },
      pagination: paginationResult(page, limit, totalItems)
    });
  } catch (error) {
    console.error('Error fetching farmer dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load farmer dashboard.' });
  }
});

// POST /api/farmer/request-pickup - Farmer requests milk pickup & creates Milk Batch ID
router.post('/request-pickup', async (req, res) => {
  let idempotencyKey;
  let requestHash;
  try {
    const { liters, notes } = req.body;
    const farmerId = req.user.id;
    const vol = Number(liters);
    if (!Number.isFinite(vol) || vol <= 0 || vol > 10000) {
      return res.status(400).json({ success: false, message: 'Please enter a valid milk volume between 0 and 10,000 liters.' });
    }
    idempotencyKey = getIdempotencyKey(req, farmerId, 'pickup');
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: 'A valid Idempotency-Key header is required.' });
    }
    requestHash = hashPayload({ liters: vol, notes: String(notes || '').trim() });
    const existing = await MilkBatch.findOne({ farmerId, idempotencyKey });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return res.status(409).json({ success: false, message: 'This request key was already used for a different pickup.' });
      }
      return res.json({
        success: true,
        message: `Milk Batch ${existing.batchId} was already registered.`,
        batch: existing,
        batchId: existing.batchId
      });
    }

    const farmer = await User.findOne({ _id: farmerId, role: 'farmer' }).lean();
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });

    const newBatchId = generateBatchId();
    const batchDoc = await MilkBatch.create({
      batchId: newBatchId,
      farmerId: farmer._id.toString(),
      idempotencyKey,
      requestHash,
      farmerName: farmer.name,
      farmName: farmer.farmName,
      farmLocation: farmer.location,
      agentId: '',
      agentName: 'Assigned Delivery Agent',
      liters: vol,
      status: 'Collected',
      collectionDate: new Date(),
      notes: notes || 'Morning collection batch',
      qualityTest: null,
      qualityHistory: [],
      rejection: null,
      auditHistory: [{
        fromStatus: 'None',
        toStatus: 'Collected',
        changedBy: farmer.name || 'Farmer',
        changedById: farmer._id.toString(),
        changedAt: new Date(),
        reason: 'Farmer logged collection pickup request',
        remarks: `Unique Batch ID assigned: ${newBatchId}`
      }]
    });
    return res.status(201).json({
      success: true,
      message: `Milk Batch ${newBatchId} for ${vol} Liters registered successfully! Awaiting Delivery Agent inspection.`,
      batch: batchDoc.toObject(),
      batchId: newBatchId
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const existing = await MilkBatch.findOne({ farmerId: req.user.id, idempotencyKey });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return res.status(409).json({ success: false, message: 'This request key was already used for a different pickup.' });
        }
        return res.json({ success: true, message: 'Pickup request was already processed.', batch: existing, batchId: existing.batchId });
      }
    }
    console.error('Error requesting farmer pickup:', error);
    return res.status(500).json({ success: false, message: 'Unable to register milk pickup.' });
  }
});

// GET /api/farmer/history
router.get('/history', async (req, res) => {
  const authenticatedFarmerId = req.user.id;
  const batchFilter = { farmerId: authenticatedFarmerId };
  const transactionFilter = { farmerId: authenticatedFarmerId };
  const search = String(req.query.search || '').trim().slice(0, 100);
  if (search) {
    const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    batchFilter.$or = ['batchId', 'status', 'notes'].map(field => ({ [field]: expression }));
    transactionFilter.$or = ['type', 'status', 'reference'].map(field => ({ [field]: expression }));
  }
  const batchPagination = getPagination({
    ...req.query,
    page: req.query.batchPage || req.query.page
  }, 6);
  const transactionPagination = getPagination({
    ...req.query,
    page: req.query.transactionPage || req.query.page
  }, 6);
  const [batches, batchCount, txs, transactionCount] = await Promise.all([
    MilkBatch.find(batchFilter).sort({ collectionDate: -1, _id: -1 }).skip(batchPagination.skip).limit(batchPagination.limit).lean(),
    MilkBatch.countDocuments(batchFilter),
    Transaction.find(transactionFilter).sort({ timestamp: -1, _id: -1 }).skip(transactionPagination.skip).limit(transactionPagination.limit).lean(),
    Transaction.countDocuments(transactionFilter)
  ]);
  const logs = batches.map(batch => ({
    id: batch._id.toString(),
    batchId: batch.batchId,
    farmerId: batch.farmerId,
    farmerName: batch.farmName || batch.farmerName,
    liters: batch.liters,
    fatPercentage: batch.qualityTest?.fatPercentage || 0,
    snfPercentage: batch.qualityTest?.snfPercentage || 0,
    ratePerLiter: batch.qualityTest?.ratePerLiter || 0,
    totalPrice: batch.qualityTest?.totalPrice || 0,
    timestamp: batch.collectionDate,
    status: batch.status
  }));

  return res.json({
    success: true,
    batches,
    logs,
    transactions: txs,
    pagination: {
      batches: paginationResult(batchPagination.page, batchPagination.limit, batchCount),
      transactions: paginationResult(transactionPagination.page, transactionPagination.limit, transactionCount)
    }
  });
});

// POST /api/farmer/payout
router.post('/payout', async (req, res) => {
  const { amount } = req.body;
  const farmerId = req.user.id;
  
  const payoutAmt = parseFloat(amount);
  if (!Number.isFinite(payoutAmt) || payoutAmt <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid positive withdrawal amount.' });
  }

  const idempotencyKey = getIdempotencyKey(req, farmerId, 'farmer-payout');
  if (!idempotencyKey) {
    return res.status(400).json({ success: false, message: 'A valid Idempotency-Key header is required.' });
  }
  const requestHash = hashPayload({ amount: payoutAmt });
  const previousRequest = await Transaction.findOne({ idempotencyKey });
  if (previousRequest) {
    if (previousRequest.requestHash !== requestHash || previousRequest.farmerId !== farmerId) {
      return res.status(409).json({ success: false, message: 'This request key was already used for a different withdrawal.' });
    }
    const currentFarmer = await User.findById(farmerId).select('balance').lean();
    return res.json({
      success: true,
      message: 'Payout request was already processed.',
      remainingBalance: currentFarmer?.balance || 0,
      transaction: { ...previousRequest.toObject(), id: previousRequest._id.toString() }
    });
  }
  const reference = `WTH-${idempotencyKey}`;
  let result;
  try {
    result = await withMongoTransaction(async session => {
      const farmer = await User.findOneAndUpdate(
        { _id: farmerId, role: 'farmer', balance: { $gte: payoutAmt } },
        { $inc: { balance: -payoutAmt } },
        { returnDocument: 'after', runValidators: true, session }
      );
      if (!farmer) return null;
      const [savedTransaction] = await Transaction.create([{
        farmerId: farmer._id.toString(),
        amount: payoutAmt,
        type: 'Bank Withdrawal',
        date: new Date().toLocaleDateString(),
        timestamp: new Date(),
        status: 'Processing',
        reference,
        idempotencyKey,
        requestHash
      }], { session, ordered: true });
      await createNotification({
        userId: farmerId,
        role: 'farmer',
        title: 'Payout request submitted',
        message: `Withdrawal of ₹${payoutAmt.toFixed(2)} is being processed.`,
        type: 'info',
        session
      });
      return { farmer, savedTransaction };
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Transaction.findOne({ idempotencyKey });
      if (duplicate?.requestHash === requestHash && duplicate.farmerId === farmerId) {
        const currentFarmer = await User.findById(farmerId).select('balance').lean();
        return res.json({
          success: true,
          message: 'Payout request was already processed.',
          remainingBalance: currentFarmer?.balance || 0,
          transaction: { ...duplicate.toObject(), id: duplicate._id.toString() }
        });
      }
    }
    return respondToDatabaseWriteError(res, error, 'Unable to request farmer payout.');
  }

  if (!result) {
    const existingFarmer = await User.findOne({ _id: farmerId, role: 'farmer' }).select('balance').lean();
    if (!existingFarmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });
    return res.status(400).json({
      success: false,
      message: `Insufficient balance. Available: ₹${(existingFarmer.balance || 0).toFixed(2)}, Requested: ₹${payoutAmt.toFixed(2)}`
    });
  }

  const { farmer, savedTransaction } = result;
  const newTx = { ...savedTransaction.toObject(), id: savedTransaction._id.toString() };

  return res.json({
    success: true,
    message: `Payout request of ₹${payoutAmt.toFixed(2)} initiated successfully!`,
    remainingBalance: farmer.balance,
    transaction: newTx
  });
});

// PUT /api/farmer/settings
router.put('/settings', async (req, res) => {
  const { farmName, location, cattleCount, bankDetails } = req.body;
  const updates = {};
  if (farmName !== undefined) updates.farmName = farmName;
  if (location !== undefined) updates.location = location;
  if (cattleCount !== undefined) updates.cattleCount = Number(cattleCount);
  if (bankDetails && typeof bankDetails === 'object') {
    if (bankDetails.accountNo !== undefined) updates['bankDetails.accountNo'] = bankDetails.accountNo;
    if (bankDetails.ifsc !== undefined) updates['bankDetails.ifsc'] = bankDetails.ifsc;
    if (bankDetails.bankName !== undefined) updates['bankDetails.bankName'] = bankDetails.bankName;
  }
  try {
    const farmer = await User.findOneAndUpdate(
      { _id: req.user.id, role: 'farmer' },
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });
    return res.json({
      success: true,
      message: 'Farmer profile & settings updated successfully!',
      farmer: farmer.toAuthJSON()
    });
  } catch (error) {
    console.error('Error updating farmer settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to update farmer settings.' });
  }
});

module.exports = router;

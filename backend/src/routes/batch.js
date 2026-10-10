const express = require('express');
const router = express.Router();
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { getPagination, paginationResult } = require('../utils/pagination');
const { generateBatchId } = require('../utils/batchId');

router.get('/', verifyToken, requireRole(['admin', 'farmer', 'delivery_agent']), async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const query = {};
    if (req.user.role === 'farmer') query.farmerId = req.user.id;
    if (req.user.role === 'delivery_agent') query.agentId = req.user.id;
    if (req.query.status && !['all', 'All'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.farmerId && req.user.role === 'admin') query.farmerId = req.query.farmerId;
    if (req.query.agentId && req.user.role === 'admin') query.agentId = req.query.agentId;
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (search) {
      const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = ['batchId', 'farmerName', 'farmName', 'agentName'].map(field => ({ [field]: expression }));
    }
    const [batches, totalItems] = await Promise.all([
      MilkBatch.find(query).sort({ collectionDate: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      MilkBatch.countDocuments(query)
    ]);
    return res.json({
      success: true,
      count: batches.length,
      batches,
      pagination: paginationResult(page, limit, totalItems)
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    return res.status(500).json({ success: false, message: 'Unable to retrieve batches.' });
  }
});

router.get('/trace/:batchId', async (req, res) => {
  try {
    const batch = await MilkBatch.findOne({ batchId: req.params.batchId })
      .select('batchId farmerName farmName farmLocation agentName liters status collectionDate qualityTest auditHistory')
      .lean();
    if (!batch) return res.status(404).json({ success: false, message: `Batch ${req.params.batchId} not found.` });
    return res.json({
      success: true,
      traceability: {
        batchId: batch.batchId,
        farmer: {
          name: batch.farmerName,
          farmName: batch.farmName,
          location: batch.farmLocation
        },
        agentName: batch.agentName,
        liters: batch.liters,
        status: batch.status,
        collectionDate: batch.collectionDate,
        qualityTest: batch.qualityTest,
        timeline: batch.auditHistory
      }
    });
  } catch (error) {
    console.error('Error loading public batch trace:', error);
    return res.status(500).json({ success: false, message: 'Unable to retrieve traceability information.' });
  }
});

router.get('/:batchId', verifyToken, requireRole(['admin', 'farmer', 'delivery_agent']), async (req, res) => {
  try {
    const batch = await MilkBatch.findOne({ batchId: req.params.batchId }).lean();
    if (!batch) return res.status(404).json({ success: false, message: `Milk Batch ${req.params.batchId} not found.` });
    if (req.user.role === 'farmer' && batch.farmerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You may only access your own batches.' });
    }
    if (req.user.role === 'delivery_agent' && batch.agentId && batch.agentId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'This batch is assigned to another agent.' });
    }
    return res.json({ success: true, batch });
  } catch (error) {
    console.error('Error retrieving batch details:', error);
    return res.status(500).json({ success: false, message: 'Unable to retrieve batch details.' });
  }
});

router.post('/create', verifyToken, requireRole(['farmer', 'admin']), async (req, res) => {
  try {
    res.set('Deprecation', 'true');
    res.set('Link', '</api/farmer/request-pickup>; rel="successor-version"');
    const { farmerName, farmName, farmLocation, liters, notes } = req.body;
    const quantity = Number(liters);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Milk quantity must be greater than 0.' });
    }
    const farmerId = req.user.role === 'farmer' ? req.user.id : String(req.body.farmerId || '');
    if (!farmerId || !(await User.exists({ _id: farmerId, role: 'farmer' }))) {
      return res.status(400).json({ success: false, message: 'A valid farmer account is required.' });
    }
    const farmer = await User.findById(farmerId).select('name farmName location').lean();
    let batch;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        batch = await MilkBatch.create({
          batchId: generateBatchId(),
          farmerId,
          farmerName: farmerName || farmer.name,
          farmName: farmName || farmer.farmName,
          farmLocation: farmLocation || farmer.location,
          liters: quantity,
          status: 'Collected',
          notes: notes || '',
          auditHistory: [{
            fromStatus: 'None',
            toStatus: 'Collected',
            changedBy: req.user.name,
            changedById: req.user.id,
            reason: 'Initial collection batch logged'
          }]
        });
        break;
      } catch (error) {
        if (error.code !== 11000 || attempt === 2) throw error;
      }
    }
    return res.status(201).json({
      success: true,
      message: `Milk Batch ${batch.batchId} created successfully!`,
      batch
    });
  } catch (error) {
    console.error('Error creating milk batch:', error);
    return res.status(500).json({ success: false, message: 'Unable to create milk batch.' });
  }
});

router.put('/:batchId/status', verifyToken, requireRole(['admin', 'delivery_agent']), async (req, res) => {
  try {
    const { newStatus, reason, remarks } = req.body;
    const previousStatus = newStatus === 'In Transit' ? 'Accepted' : newStatus === 'Delivered' ? 'In Transit' : '';
    if (!previousStatus) {
      return res.status(400).json({ success: false, message: 'Only accepted batches can enter transit, and only in-transit batches can be delivered.' });
    }
    const batch = await MilkBatch.findOne({ batchId: req.params.batchId });
    if (!batch) return res.status(404).json({ success: false, message: 'Milk batch not found.' });
    if (req.user.role === 'delivery_agent' && batch.agentId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'This batch is assigned to another delivery agent.' });
    }
    if (batch.status !== previousStatus) {
      return res.status(409).json({ success: false, message: `Batch must be ${previousStatus} before it can become ${newStatus}.` });
    }
    const updatedBatch = await MilkBatch.findOneAndUpdate({
      _id: batch._id,
      status: previousStatus,
      ...(req.user.role === 'delivery_agent' ? { agentId: req.user.id } : {})
    }, {
      $set: { status: newStatus },
      $push: {
        auditHistory: {
          fromStatus: previousStatus,
          toStatus: newStatus,
          changedBy: req.user.name || 'System',
          changedById: req.user.id,
          reason: reason || '',
          remarks: remarks || ''
        }
      }
    }, { returnDocument: 'after' });
    if (!updatedBatch) return res.status(409).json({ success: false, message: 'Milk batch status changed; refresh and retry.' });
    return res.json({
      success: true,
      message: `Batch ${updatedBatch.batchId} status updated to ${newStatus}.`,
      batch: updatedBatch
    });
  } catch (error) {
    console.error('Error updating batch status:', error);
    return res.status(500).json({ success: false, message: 'Unable to update batch status.' });
  }
});

module.exports = router;

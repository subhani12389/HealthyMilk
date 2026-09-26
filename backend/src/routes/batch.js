const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MilkBatch = require('../models/MilkBatch');
const { milkBatches, generateBatchId, notifications } = require('../store');

// GET /api/batches - List and filter batches
router.get('/', async (req, res) => {
  try {
    const { status, farmerId, agentId, search } = req.query;
    
    // Attempt to query MongoDB first if connected
    let batches = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const query = {};
        if (status && status !== 'all' && status !== 'All') {
          query.status = status;
        }
        if (farmerId) {
          query.farmerId = farmerId;
        }
        if (agentId) {
          query.agentId = agentId;
        }
        if (search) {
          const regex = new RegExp(search, 'i');
          query.$or = [
            { batchId: regex },
            { farmerName: regex },
            { farmName: regex },
            { agentName: regex }
          ];
        }

        batches = await MilkBatch.find(query).sort({ collectionDate: -1 }).lean();
      } catch (dbErr) {
        batches = [];
      }
    }

    if (!batches || batches.length === 0) {
      let filtered = [...milkBatches];
      if (status && status !== 'all' && status !== 'All') {
        filtered = filtered.filter(b => b.status.toLowerCase() === status.toLowerCase());
      }
      if (farmerId) {
        filtered = filtered.filter(b => b.farmerId === farmerId);
      }
      if (agentId) {
        filtered = filtered.filter(b => b.agentId === agentId);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(b => 
          (b.batchId && b.batchId.toLowerCase().includes(s)) ||
          (b.farmerName && b.farmerName.toLowerCase().includes(s)) ||
          (b.farmName && b.farmName.toLowerCase().includes(s)) ||
          (b.agentName && b.agentName.toLowerCase().includes(s))
        );
      }
      batches = filtered;
    }

    return res.json({
      success: true,
      count: batches.length,
      batches
    });
  } catch (err) {
    console.error('Error fetching batches:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving batches.' });
  }
});

// GET /api/batches/:batchId - Single batch traceability details
router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    let batch = null;

    if (mongoose.connection.readyState === 1) {
      try {
        batch = await MilkBatch.findOne({ batchId }).lean();
      } catch (dbErr) {}
    }

    if (!batch) {
      batch = milkBatches.find(b => b.batchId === batchId || b.id === batchId);
    }

    if (!batch) {
      return res.status(404).json({ success: false, message: `Milk Batch ${batchId} not found.` });
    }

    return res.json({
      success: true,
      batch
    });
  } catch (err) {
    console.error('Error retrieving batch details:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving batch details.' });
  }
});

// POST /api/batches/create - Create new Milk Batch
router.post('/create', async (req, res) => {
  try {
    const { farmerId, farmerName, farmName, farmLocation, agentId, agentName, liters, notes } = req.body;
    
    const qty = parseFloat(liters);
    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid milk quantity. Must be greater than 0.' });
    }

    const newBatchId = generateBatchId();

    const batchDoc = {
      batchId: newBatchId,
      farmerId: farmerId || 'farmer_1',
      farmerName: farmerName || 'Dairy Farmer',
      farmName: farmName || 'Organic Farm',
      farmLocation: farmLocation || 'Kaira Valley, Anand',
      agentId: agentId || 'agent_1',
      agentName: agentName || 'Assigned Delivery Agent',
      liters: qty,
      status: 'Collected',
      collectionDate: new Date().toISOString(),
      notes: notes || 'Morning collection',
      qualityTest: null,
      qualityHistory: [],
      rejection: null,
      auditHistory: [
        {
          fromStatus: 'None',
          toStatus: 'Collected',
          changedBy: farmerName || 'Farmer',
          changedById: farmerId || 'farmer_1',
          changedAt: new Date().toISOString(),
          reason: 'Initial collection batch logged',
          remarks: `Generated unique batch ID: ${newBatchId}`
        }
      ]
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const created = new MilkBatch(batchDoc);
        await created.save();
      } catch (dbErr) {
        console.warn('DB Batch save fallback:', dbErr.message);
      }
    }

    milkBatches.unshift(batchDoc);

    return res.status(201).json({
      success: true,
      message: `Milk Batch ${newBatchId} created successfully!`,
      batch: batchDoc
    });
  } catch (err) {
    console.error('Error creating milk batch:', err);
    return res.status(500).json({ success: false, message: 'Server error creating milk batch.' });
  }
});

// PUT /api/batches/:batchId/status - Update batch status with audit record
router.put('/:batchId/status', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { newStatus, changedBy, changedById, reason, remarks } = req.body;

    const validStatuses = ['Collected', 'Quality Checked', 'Accepted', 'Rejected', 'In Transit', 'Delivered'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    let batch = null;
    if (mongoose.connection.readyState === 1) {
      try {
        batch = await MilkBatch.findOne({ batchId });
        if (batch) {
          const prevStatus = batch.status;
          batch.status = newStatus;
          batch.addAuditLog(prevStatus, newStatus, changedBy, changedById, reason, remarks);
          await batch.save();
        }
      } catch (dbErr) {}
    }

    const memBatch = milkBatches.find(b => b.batchId === batchId || b.id === batchId);
    if (memBatch) {
      const prevStatus = memBatch.status;
      memBatch.status = newStatus;
      if (!memBatch.auditHistory) memBatch.auditHistory = [];
      memBatch.auditHistory.unshift({
        fromStatus: prevStatus,
        toStatus: newStatus,
        changedBy: changedBy || 'Delivery Agent',
        changedById: changedById || '',
        changedAt: new Date().toISOString(),
        reason: reason || 'Status updated',
        remarks: remarks || ''
      });
    }

    if (!batch && !memBatch) {
      return res.status(404).json({ success: false, message: 'Milk Batch not found.' });
    }

    return res.json({
      success: true,
      message: `Batch ${batchId} status updated to ${newStatus}`,
      batch: batch || memBatch
    });
  } catch (err) {
    console.error('Error updating batch status:', err);
    return res.status(500).json({ success: false, message: 'Server error updating batch status.' });
  }
});

module.exports = router;

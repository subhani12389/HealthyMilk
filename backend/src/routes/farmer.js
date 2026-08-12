const express = require('express');
const router = express.Router();
const { users, milkLogs, transactions, notifications } = require('../store');

// GET /api/farmer/dashboard?farmerId=
router.get('/dashboard', (req, res) => {
  const { farmerId } = req.query;
  const farmer = users.find(u => u.id === (farmerId || 'farmer_1') && u.role === 'farmer') || users.find(u => u.role === 'farmer');

  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer account not found.' });

  const logs = milkLogs.filter(l => l.farmerId === farmer.id);
  const todayLog = logs[0] || null;

  const totalLitersAllTime = logs.filter(l => l.status.includes('Collected') || l.status === 'Delivered').reduce((acc, curr) => acc + curr.liters, 0);
  const totalEarningsAllTime = logs.filter(l => l.status.includes('Collected') || l.status === 'Delivered').reduce((acc, curr) => acc + curr.totalPrice, 0);

  return res.json({
    success: true,
    farmer: {
      id: farmer.id,
      name: farmer.name,
      farmName: farmer.farmName,
      location: farmer.location,
      balance: farmer.balance,
      rating: farmer.rating,
      cattleCount: farmer.cattleCount,
      bankDetails: farmer.bankDetails
    },
    currentMilkStatus: todayLog ? {
      id: todayLog.id,
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
    } : null,
    stats: {
      totalLitersAllTime,
      totalEarningsAllTime,
      pendingPayout: farmer.balance,
      logsCount: logs.length
    }
  });
});

// POST /api/farmer/request-pickup - Farmer requests milk pickup (Pending Agent Inspection)
router.post('/request-pickup', (req, res) => {
  const { farmerId, liters, notes } = req.body;

  const farmer = users.find(u => u.id === (farmerId || 'farmer_1'));
  if (!farmer) {
    return res.status(404).json({ success: false, message: 'Farmer not found.' });
  }

  const vol = parseFloat(liters);
  if (!vol || vol <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid milk volume in Liters.' });
  }

  const newRequest = {
    id: `log_${Date.now()}`,
    farmerId: farmer.id,
    farmerName: farmer.farmName || farmer.name,
    liters: vol,
    fatPercentage: 0, // Unchecked until Agent inspection
    snfPercentage: 0, // Unchecked until Agent inspection
    lactometerReading: 0,
    ratePerLiter: 0, // Uncalculated until Agent tests fat & SNF
    totalPrice: 0,   // Money not added until Agent tests
    timestamp: new Date().toISOString(),
    dateStr: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'Collection Requested (Awaiting Agent Inspection)',
    agentName: 'John Doe (Delivery Agent)',
    notes: notes || 'Fresh morning batch ready for testing',
    qualityScore: 0
  };

  milkLogs.unshift(newRequest);

  // Notify delivery agent
  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: 'agent_1',
    title: 'New Milk Pickup Requested',
    message: `${farmer.farmName || farmer.name} requested pickup for ${vol} Liters. Please inspect Fat & SNF.`,
    time: 'Just now',
    read: false,
    type: 'info'
  });

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: farmer.id,
    title: 'Pickup Request Submitted',
    message: `Collection request for ${vol}L submitted! Delivery Agent John Doe is on his way to inspect Fat & SNF % and credit funds.`,
    time: 'Just now',
    read: false,
    type: 'info'
  });

  return res.json({
    success: true,
    message: `Milk pickup request for ${vol} Liters submitted successfully! Awaiting Delivery Agent quality inspection.`,
    request: newRequest
  });
});

// GET /api/farmer/history
router.get('/history', (req, res) => {
  const { farmerId } = req.query;
  const fId = farmerId || 'farmer_1';
  const logs = milkLogs.filter(l => l.farmerId === fId);
  const txs = transactions.filter(t => t.farmerId === fId);

  return res.json({
    success: true,
    logs,
    transactions: txs
  });
});

// POST /api/farmer/payout
router.post('/payout', (req, res) => {
  const { farmerId, amount } = req.body;
  const farmer = users.find(u => u.id === (farmerId || 'farmer_1'));

  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

  const payoutAmt = parseFloat(amount) || farmer.balance;

  if (payoutAmt <= 0 || payoutAmt > farmer.balance) {
    return res.status(400).json({ success: false, message: 'Invalid withdrawal amount.' });
  }

  farmer.balance -= payoutAmt;

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
    message: `Withdrawal of ₹${payoutAmt.toFixed(2)} requested to A/C ${farmer.bankDetails?.accountNo || 'SBI'}.`,
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
  const farmer = users.find(u => u.id === (farmerId || 'farmer_1'));

  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

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

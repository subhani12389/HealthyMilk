const express = require('express');
const router = express.Router();
const { deliveryTasks, milkLogs, users, transactions, notifications } = require('../store');

// GET /api/delivery/dashboard?agentId=
router.get('/dashboard', (req, res) => {
  const { agentId } = req.query;
  let agent = users.find(u => u.id === agentId && (u.role === 'agent' || u.role === 'delivery_agent'));
  if (!agent) {
    agent = users.find(u => u.role === 'agent' || u.role === 'delivery_agent');
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
      farmerPickups: milkLogs,
      consumerDeliveries: deliveryTasks
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
    farmerPickups: milkLogs,
    consumerDeliveries: deliveryTasks
  });
});

// GET /api/delivery/tasks
router.get('/tasks', (req, res) => {
  return res.json({
    success: true,
    farmerPickups: milkLogs,
    consumerDeliveries: deliveryTasks
  });
});

// POST /api/delivery/test-and-collect - Quality test, credit Farmer milk money & credit Agent delivery fee
router.post('/test-and-collect', (req, res) => {
  const { pickupId, testedFat, testedSNF, lactometerReading, agentName, agentId } = req.body;

  const log = milkLogs.find(l => l.id === pickupId);
  if (!log) {
    return res.status(404).json({ success: false, message: 'Milk pickup record not found.' });
  }

  const fat = parseFloat(testedFat);
  const snf = parseFloat(testedSNF);
  const lacto = parseFloat(lactometerReading) || 29.5;

  if (isNaN(fat) || fat <= 0 || isNaN(snf) || snf <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter valid Fat % and SNF % values.' });
  }

  // Calculate Rate per Liter dynamically based on Fat & SNF
  const baseRate = 45;
  const fatDiff = fat - 3.5;
  const snfDiff = snf - 8.5;

  const ratePerLiter = Math.max(35, Math.round(baseRate + (fatDiff * 6) + (snfDiff * 4)));
  const totalPrice = log.liters * ratePerLiter;
  const qualityScore = Math.min(100, Math.round((fat / 4.5) * 50 + (snf / 8.5) * 50));

  // Update Milk Log
  log.fatPercentage = fat;
  log.snfPercentage = snf;
  log.lactometerReading = lacto;
  log.ratePerLiter = ratePerLiter;
  log.totalPrice = totalPrice;
  log.qualityScore = qualityScore;
  log.status = 'Tested & Picked Up by Agent';
  log.agentName = agentName || 'Delivery Agent';

  // Credit Farmer Account Balance
  const farmer = users.find(u => u.id === log.farmerId);
  if (farmer) {
    farmer.balance = (farmer.balance || 0) + totalPrice;

    transactions.unshift({
      id: `tx_${Date.now()}`,
      farmerId: farmer.id,
      amount: totalPrice,
      type: 'Credit (Milk Deposit - Verified by Agent)',
      date: new Date().toLocaleDateString(),
      status: 'Completed',
      reference: `DEP-${Math.floor(1000 + Math.random() * 9000)}-${farmer.name.split(' ')[0].toUpperCase()}`
    });

    notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: farmer.id,
      title: 'Milk Quality Tested & Money Credited!',
      message: `Delivery Agent tested your ${log.liters}L batch (Fat: ${fat}%, SNF: ${snf}%). Rate: ₹${ratePerLiter}/L. ₹${totalPrice.toFixed(2)} credited to your balance!`,
      time: 'Just now',
      read: false,
      type: 'success'
    });
  }

  // Credit Delivery Agent Fee (₹50 per verified collection)
  const agent = users.find(u => u.id === agentId || u.role === 'agent' || u.role === 'delivery_agent');
  if (agent) {
    agent.balance = (agent.balance || 0) + 50;
    agent.totalDeliveries = (agent.totalDeliveries || 0) + 1;

    transactions.unshift({
      id: `tx_${Date.now()}`,
      agentId: agent.id,
      amount: 50,
      type: 'Credit (Pickup & Inspection Fee)',
      date: new Date().toLocaleDateString(),
      status: 'Completed',
      reference: `AG-${Math.floor(1000 + Math.random() * 9000)}`
    });

    notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: agent.id,
      title: 'Delivery Fee Credited',
      message: `₹50.00 collection fee added to your balance for inspecting ${farmer ? farmer.name : 'Farmer'} batch.`,
      time: 'Just now',
      read: false,
      type: 'success'
    });
  }

  return res.json({
    success: true,
    message: `Quality tested (Fat: ${fat}%, SNF: ${snf}%). Rate: ₹${ratePerLiter}/L. ₹${totalPrice.toFixed(2)} credited to ${farmer ? farmer.name : 'Farmer'}! Agent fee ₹50 credited.`,
    log,
    creditedAmount: totalPrice,
    calculatedRate: ratePerLiter,
    updatedFarmerBalance: farmer ? farmer.balance : null,
    updatedAgentBalance: agent ? agent.balance : null
  });
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
router.post('/update-status', (req, res) => {
  const { taskId, status, type, agentId } = req.body;

  if (type === 'farmer_pickup') {
    const log = milkLogs.find(l => l.id === taskId);
    if (log) {
      log.status = status;
      return res.json({ success: true, message: `Farmer pickup status updated to ${status}`, log });
    }
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

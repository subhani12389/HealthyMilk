const express = require('express');
const router = express.Router();
const { users, deliveryTasks, notifications } = require('../store');

// GET /api/consumer/dashboard?consumerId=
router.get('/dashboard', (req, res) => {
  const { consumerId } = req.query;
  const consumer = users.find(u => u.id === (consumerId || 'consumer_1') && u.role === 'consumer') || users.find(u => u.role === 'consumer');

  const todayTask = deliveryTasks.find(t => t.consumerId === consumer.id) || deliveryTasks[0];
  const history = deliveryTasks.filter(t => t.consumerId === consumer.id);

  return res.json({
    success: true,
    consumer: {
      id: consumer.id,
      name: consumer.name,
      email: consumer.email,
      address: consumer.address,
      phone: consumer.phone,
      subscription: consumer.subscription
    },
    currentMilkStatus: {
      deliveryId: todayTask ? todayTask.id : 'del_101',
      status: todayTask ? todayTask.status : 'Out for Delivery',
      liters: consumer.subscription ? consumer.subscription.dailyLiters : 2,
      milkType: consumer.subscription ? consumer.subscription.planName : 'Pure A2 Cow Milk',
      timeSlot: consumer.subscription ? consumer.subscription.deliveryTimeSlot : '6:30 AM - 7:30 AM',
      eta: todayTask ? (todayTask.eta || '07:15 AM') : '07:15 AM',
      agentName: todayTask ? (todayTask.agentName || 'John Doe') : 'John Doe',
      farmerName: 'Patel Dairy Farm',
      qualityDetails: {
        fat: '4.5%',
        purity: '100% Pure Organic',
        temperature: '4°C Chilled'
      }
    },
    history
  });
});

// POST /api/consumer/pause-subscription
router.post('/pause-subscription', (req, res) => {
  const { consumerId } = req.body;
  const consumer = users.find(u => u.id === (consumerId || 'consumer_1'));

  if (!consumer || !consumer.subscription) {
    return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
  }

  const currentStatus = consumer.subscription.status;
  const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
  consumer.subscription.status = newStatus;

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: consumer.id,
    title: `Subscription ${newStatus}`,
    message: `Your daily milk subscription has been ${newStatus.toLowerCase()}.`,
    time: 'Just now',
    read: false,
    type: newStatus === 'Active' ? 'success' : 'warning'
  });

  return res.json({
    success: true,
    message: `Subscription successfully ${newStatus.toLowerCase()}!`,
    subscription: consumer.subscription
  });
});

// POST /api/consumer/update-quantity
router.post('/update-quantity', (req, res) => {
  const { consumerId, dailyLiters } = req.body;
  const consumer = users.find(u => u.id === (consumerId || 'consumer_1'));

  if (!consumer || !consumer.subscription) {
    return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
  }

  const qty = parseFloat(dailyLiters);
  if (!qty || qty <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid daily quantity.' });
  }

  consumer.subscription.dailyLiters = qty;

  return res.json({
    success: true,
    message: `Daily milk quantity updated to ${qty} Liters/day.`,
    subscription: consumer.subscription
  });
});

// POST /api/consumer/renew-subscription
router.post('/renew-subscription', (req, res) => {
  const { consumerId, planDays } = req.body;
  const consumer = users.find(u => u.id === (consumerId || 'consumer_1'));

  if (!consumer || !consumer.subscription) {
    return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
  }

  const days = parseInt(planDays) || 30;
  consumer.subscription.daysRemaining = days;
  consumer.subscription.totalDays = days;
  consumer.subscription.status = 'Active';
  consumer.subscription.startDate = new Date().toISOString().split('T')[0];
  consumer.subscription.endDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: consumer.id,
    title: 'Subscription Renewed!',
    message: `Your ${days}-day plan has been renewed. Full ${days} days remaining.`,
    time: 'Just now',
    read: false,
    type: 'success'
  });

  return res.json({
    success: true,
    message: `Subscription renewed successfully for ${days} days!`,
    subscription: consumer.subscription
  });
});

// POST /api/consumer/simulate-delivery-day
router.post('/simulate-delivery-day', (req, res) => {
  const { consumerId } = req.body;
  const consumer = users.find(u => u.id === (consumerId || 'consumer_1'));

  if (!consumer || !consumer.subscription) {
    return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
  }

  if (consumer.subscription.daysRemaining > 0 && consumer.subscription.status === 'Active') {
    consumer.subscription.daysRemaining -= 1;
    if (consumer.subscription.daysRemaining === 0) {
      consumer.subscription.status = 'Expired';
    }
  }

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: consumer.id,
    title: 'Daily Milk Delivered & Day Deducted',
    message: `Today's ${consumer.subscription.dailyLiters}L milk delivered! ${consumer.subscription.daysRemaining} days remaining in your plan.`,
    time: 'Just now',
    read: false,
    type: 'info'
  });

  return res.json({
    success: true,
    message: 'Simulated 1 day delivery deduction!',
    daysRemaining: consumer.subscription.daysRemaining,
    status: consumer.subscription.status
  });
});

// PUT /api/consumer/settings
router.put('/settings', (req, res) => {
  const { consumerId, address, phone, deliveryTimeSlot } = req.body;
  const consumer = users.find(u => u.id === (consumerId || 'consumer_1'));

  if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

  if (address) consumer.address = address;
  if (phone) consumer.phone = phone;
  if (deliveryTimeSlot && consumer.subscription) {
    consumer.subscription.deliveryTimeSlot = deliveryTimeSlot;
  }

  return res.json({
    success: true,
    message: 'Consumer delivery settings updated!',
    consumer
  });
});

module.exports = router;

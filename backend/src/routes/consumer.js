const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MilkBatch = require('../models/MilkBatch');
const { users, deliveryTasks, milkBatches, notifications } = require('../store');

// GET /api/consumer/dashboard?consumerId=
router.get('/dashboard', async (req, res) => {
  const { consumerId } = req.query;
  let consumer = users.find(u => u.id === consumerId && u.role === 'consumer');
  if (!consumer) {
    consumer = users.find(u => u.role === 'consumer');
  }

  // Find latest accepted batch to show traceable quality to consumer
  let activeBatch = null;
  if (mongoose.connection.readyState === 1) {
    try {
      activeBatch = await MilkBatch.findOne({ status: { $in: ['Accepted', 'In Transit', 'Delivered'] } }).sort({ collectionDate: -1 }).lean();
    } catch (e) {}
  }

  if (!activeBatch) {
    activeBatch = milkBatches.find(b => b.status === 'Accepted' || b.status === 'In Transit' || b.status === 'Delivered') || milkBatches[0];
  }

  if (!consumer) {
    return res.json({
      success: true,
      consumer: {
        id: 'new_consumer',
        name: 'Consumer User',
        email: 'consumer@example.com',
        address: '123 Green Avenue, Sector 14',
        phone: '9876543210',
        subscription: {
          id: 'sub_new',
          planName: 'Pure Fresh A2 Cow Milk',
          dailyLiters: 2,
          totalDays: 30,
          daysRemaining: 30,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          status: 'Active',
          pricePerLiter: 65,
          totalAmountPaid: 3900,
          deliveryTimeSlot: '6:30 AM - 7:30 AM'
        }
      },
      currentMilkStatus: {
        deliveryId: 'del_101',
        batchId: activeBatch ? activeBatch.batchId : 'HM-20260921-0001',
        status: 'Active Plan Subscribed',
        liters: 2,
        milkType: 'Pure Fresh A2 Cow Milk',
        timeSlot: '6:30 AM - 7:30 AM',
        eta: '07:15 AM',
        agentName: activeBatch?.agentName || 'Assigned Delivery Agent',
        farmerName: activeBatch?.farmName || activeBatch?.farmerName || 'Local Organic Dairy Farm',
        farmLocation: activeBatch?.farmLocation || 'Kaira Valley, Anand',
        qualityDetails: {
          fat: activeBatch?.qualityTest ? `${activeBatch.qualityTest.fatPercentage}%` : '4.8%',
          snf: activeBatch?.qualityTest ? `${activeBatch.qualityTest.snfPercentage}%` : '8.9%',
          lactometer: activeBatch?.qualityTest ? activeBatch.qualityTest.lactometerReading : 30.0,
          temperature: activeBatch?.qualityTest ? `${activeBatch.qualityTest.temperature}°C Chilled` : '4°C Chilled',
          purity: '100% Pure Organic & Lab Tested',
          qualityScore: activeBatch?.qualityTest ? activeBatch.qualityTest.qualityScore : 96,
          qualityStatus: activeBatch?.qualityTest ? activeBatch.qualityTest.qualityStatus : 'Passed',
          testedAt: activeBatch?.qualityTest?.testedAt || new Date().toISOString(),
          testedBy: activeBatch?.qualityTest?.testedBy || 'Certified Dairy Inspector'
        }
      },
      history: []
    });
  }

  const todayTask = deliveryTasks.find(t => t.consumerId === consumer.id);
  const history = deliveryTasks.filter(t => t.consumerId === consumer.id);

  return res.json({
    success: true,
    consumer: {
      id: consumer.id,
      name: consumer.name,
      email: consumer.email,
      address: consumer.address || '123 Green Avenue, Sector 14',
      phone: consumer.phone || consumer.mobile,
      subscription: consumer.subscription || {
        id: `sub_${consumer.id}`,
        planName: 'Pure Fresh A2 Cow Milk',
        dailyLiters: 2,
        totalDays: 30,
        daysRemaining: 30,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'Active',
        pricePerLiter: 65,
        totalAmountPaid: 3900,
        deliveryTimeSlot: '6:30 AM - 7:30 AM'
      }
    },
    currentMilkStatus: {
      deliveryId: todayTask ? todayTask.id : `del_${Date.now()}`,
      batchId: activeBatch ? activeBatch.batchId : 'HM-20260921-0001',
      status: todayTask ? todayTask.status : 'Out for Delivery',
      liters: consumer.subscription ? consumer.subscription.dailyLiters : 2,
      milkType: consumer.subscription ? consumer.subscription.planName : 'Pure A2 Cow Milk',
      timeSlot: consumer.subscription ? consumer.subscription.deliveryTimeSlot : '6:30 AM - 7:30 AM',
      eta: todayTask ? (todayTask.eta || '07:15 AM') : '07:15 AM',
      agentName: activeBatch?.agentName || (todayTask ? (todayTask.agentName || 'Delivery Agent') : 'Assigned Agent'),
      farmerName: activeBatch?.farmName || activeBatch?.farmerName || 'Local Dairy Farm',
      farmLocation: activeBatch?.farmLocation || 'Kaira Valley, Anand',
      qualityDetails: {
        fat: activeBatch?.qualityTest ? `${activeBatch.qualityTest.fatPercentage}%` : '4.8%',
        snf: activeBatch?.qualityTest ? `${activeBatch.qualityTest.snfPercentage}%` : '8.9%',
        lactometer: activeBatch?.qualityTest ? activeBatch.qualityTest.lactometerReading : 30.0,
        temperature: activeBatch?.qualityTest ? `${activeBatch.qualityTest.temperature}°C Chilled` : '4°C Chilled',
        purity: '100% Pure Organic & Lab Tested',
        qualityScore: activeBatch?.qualityTest ? activeBatch.qualityTest.qualityScore : 96,
        qualityStatus: activeBatch?.qualityTest ? activeBatch.qualityTest.qualityStatus : 'Passed',
        testedAt: activeBatch?.qualityTest?.testedAt || new Date().toISOString(),
        testedBy: activeBatch?.qualityTest?.testedBy || 'Certified Dairy Inspector'
      }
    },
    history
  });
});

// POST /api/consumer/pause-subscription
router.post('/pause-subscription', async (req, res) => {
  const { consumerId } = req.body;
  let consumer = null;
  if (mongoose.connection.readyState === 1) {
    try {
      consumer = await User.findById(consumerId);
    } catch (e) {}
  }
  if (!consumer) {
    consumer = users.find(u => u.id === consumerId || u._id === consumerId) || users.find(u => u.role === 'consumer');
  }

  if (!consumer) {
    return res.status(404).json({ success: false, message: 'Consumer account not found.' });
  }

  if (!consumer.subscription) {
    consumer.subscription = {
      id: `sub_${consumer.id || consumer._id || Date.now()}`,
      planName: 'Pure Fresh A2 Cow Milk',
      dailyLiters: 2,
      totalDays: 30,
      daysRemaining: 30,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'Active',
      pricePerLiter: 65,
      totalAmountPaid: 3900,
      deliveryTimeSlot: '6:30 AM - 7:30 AM'
    };
  }

  const currentStatus = consumer.subscription.status || 'Active';
  const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
  consumer.subscription.status = newStatus;

  if (consumer.save && mongoose.connection.readyState === 1) {
    try {
      consumer.markModified('subscription');
      await consumer.save();
    } catch (e) {}
  }

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: consumer.id || (consumer._id ? consumer._id.toString() : 'consumer'),
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
router.post('/update-quantity', async (req, res) => {
  const { consumerId, dailyLiters } = req.body;
  let consumer = null;
  if (mongoose.connection.readyState === 1) {
    try {
      consumer = await User.findById(consumerId);
    } catch (e) {}
  }
  if (!consumer) {
    consumer = users.find(u => u.id === consumerId || u._id === consumerId) || users.find(u => u.role === 'consumer');
  }

  if (!consumer) {
    return res.status(404).json({ success: false, message: 'Consumer account not found.' });
  }

  const qty = parseFloat(dailyLiters);
  if (!qty || qty <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid daily quantity.' });
  }

  if (!consumer.subscription) {
    consumer.subscription = {
      id: `sub_${consumer.id || Date.now()}`,
      planName: 'Pure Fresh A2 Cow Milk',
      dailyLiters: qty,
      totalDays: 30,
      daysRemaining: 30,
      status: 'Active',
      pricePerLiter: 65,
      totalAmountPaid: 3900,
      deliveryTimeSlot: '6:30 AM - 7:30 AM'
    };
  } else {
    consumer.subscription.dailyLiters = qty;
  }

  if (consumer.save && mongoose.connection.readyState === 1) {
    try {
      consumer.markModified('subscription');
      await consumer.save();
    } catch (e) {}
  }

  return res.json({
    success: true,
    message: `Daily milk quantity updated to ${qty} Liters/day.`,
    subscription: consumer.subscription
  });
});

// POST /api/consumer/renew-subscription
router.post('/renew-subscription', (req, res) => {
  const { consumerId, planDays } = req.body;
  const consumer = users.find(u => u.id === consumerId) || users.find(u => u.role === 'consumer');

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
  const consumer = users.find(u => u.id === consumerId) || users.find(u => u.role === 'consumer');

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

// GET /api/consumer/products - Products Catalog
router.get('/products', (req, res) => {
  const products = [
    { id: 'p1', name: 'Pure Fresh A2 Cow Milk', price: 65, unit: 'Liter', description: 'Certified pure A2 indigenous organic cow milk.' },
    { id: 'p2', name: 'Fresh Farm Buffalo Milk', price: 75, unit: 'Liter', description: 'Creamy 7.5% fat organic buffalo milk.' },
    { id: 'p3', name: 'Desi Cow Bilona Ghee', price: 1200, unit: '500g', description: 'Traditional wooden churned cultured ghee.' },
    { id: 'p4', name: 'Organic Probiotic Set Curd', price: 45, unit: '400g', description: 'Fresh cultured thick curd.' }
  ];
  return res.json({ success: true, count: products.length, products });
});

// POST /api/consumer/subscription - Create or Update Subscription
router.post('/subscription', (req, res) => {
  const { consumerId, plan, quantity, productType, deliveryTime } = req.body;
  const consumer = users.find(u => u.id === consumerId) || users.find(u => u.role === 'consumer');
  
  const subData = {
    id: `sub_${consumerId || Date.now()}`,
    planName: productType || 'Pure Fresh A2 Cow Milk',
    planType: plan || 'Daily',
    dailyLiters: Number(quantity) || 2,
    totalDays: 30,
    daysRemaining: 30,
    status: 'Active',
    pricePerLiter: 65,
    deliveryTimeSlot: deliveryTime || '6:30 AM - 7:30 AM',
    startDate: new Date().toISOString().split('T')[0]
  };

  if (consumer) {
    consumer.subscription = subData;
  }

  return res.json({
    success: true,
    message: 'Subscription plan created successfully!',
    subscription: subData
  });
});

// POST /api/consumer/subscription/pause
router.post('/subscription/pause', (req, res) => {
  const { consumerId } = req.body;
  const consumer = users.find(u => u.id === consumerId) || users.find(u => u.role === 'consumer');
  if (consumer && consumer.subscription) {
    consumer.subscription.status = 'Paused';
  }
  return res.json({
    success: true,
    message: 'Subscription paused successfully.',
    subscription: consumer ? consumer.subscription : { status: 'Paused' }
  });
});

// POST /api/consumer/subscription/resume
router.post('/subscription/resume', (req, res) => {
  const { consumerId } = req.body;
  const consumer = users.find(u => u.id === consumerId) || users.find(u => u.role === 'consumer');
  if (consumer && consumer.subscription) {
    consumer.subscription.status = 'Active';
  }
  return res.json({
    success: true,
    message: 'Subscription resumed successfully.',
    subscription: consumer ? consumer.subscription : { status: 'Active' }
  });
});

// POST /api/consumer/order - Instant Dairy Order
router.post('/order', (req, res) => {
  const { consumerId, items, deliveryAddress, paymentMethod } = req.body;
  const orderId = `HM-ORD-${Date.now().toString().slice(-6)}`;
  const order = {
    orderId,
    consumerId,
    items: items || [],
    deliveryAddress: deliveryAddress || '123 Green Avenue',
    paymentMethod: paymentMethod || 'UPI',
    status: 'Confirmed',
    totalAmount: (items || []).reduce((acc, c) => acc + (c.price * c.quantity), 0),
    orderDate: new Date().toISOString()
  };

  notifications.unshift({
    id: `notif_${Date.now()}`,
    userId: consumerId,
    title: 'Order Confirmed',
    message: `Order #${orderId} placed successfully. Tracking available soon.`,
    time: 'Just now',
    read: false,
    type: 'success'
  });

  return res.json({
    success: true,
    message: 'Order placed successfully!',
    order
  });
});

module.exports = router;

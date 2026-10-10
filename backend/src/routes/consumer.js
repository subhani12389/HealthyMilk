const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const MilkBatch = require('../models/MilkBatch');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { createNotification } = require('../services/notificationService');
const { getPagination, paginationResult } = require('../utils/pagination');
const { withMongoTransaction, respondToDatabaseWriteError } = require('../config/db');
const { getIdempotencyKey, hashPayload } = require('../utils/idempotency');
const { isSubscriptionScheduledForDate, normalizeScheduleDate } = require('../utils/subscriptionSchedule');

const products = [
  { id: 'p1', name: 'Pure Fresh A2 Cow Milk', price: 65, unit: 'Liter', description: 'Certified pure A2 indigenous organic cow milk.' },
  { id: 'p2', name: 'Fresh Farm Buffalo Milk', price: 75, unit: 'Liter', description: 'Creamy 7.5% fat organic buffalo milk.' },
  { id: 'p3', name: 'Desi Cow Bilona Ghee', price: 1200, unit: '500g', description: 'Traditional wooden churned cultured ghee.' },
  { id: 'p4', name: 'Organic Probiotic Set Curd', price: 45, unit: '400g', description: 'Fresh cultured thick curd.' }
];

router.use(verifyToken, requireRole(['consumer']));

const getCurrentSubscription = (consumerId) =>
  Subscription.findOne({ consumerId, status: { $in: ['Active', 'Paused'] } }).sort({ createdAt: -1 });

const formatSubscription = (subscription) => subscription ? ({
  ...subscription.toObject(),
  id: subscription.subscriptionId
}) : null;

router.get('/dashboard', async (req, res) => {
  try {
    const consumerId = req.user.id;
    const { page, limit, skip } = getPagination(req.query, 20);
    const consumer = await User.findById(consumerId).select('name address phoneNumber').lean();
    if (!consumer) return res.status(404).json({ success: false, message: 'Consumer account not found.' });
    const [subscription, totalItems, deliveries] = await Promise.all([
      getCurrentSubscription(consumerId),
      Delivery.countDocuments({ consumerId }),
      Delivery.find({ consumerId })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
    const currentDelivery = deliveries.find(delivery => !['Delivered', 'Cancelled'].includes(delivery.status));
    const currentBatch = currentDelivery?.batchId
      ? await MilkBatch.findOne({ batchId: currentDelivery.batchId })
        .select('batchId farmerName farmName farmLocation agentName qualityTest')
        .lean()
      : null;

    return res.json({
      success: true,
      consumer: {
        id: consumerId,
        name: consumer.name,
        address: consumer.address || '',
        phone: consumer.phoneNumber,
        subscription: formatSubscription(subscription)
      },
      currentMilkStatus: currentDelivery ? {
        deliveryId: currentDelivery.deliveryId,
        batchId: currentBatch?.batchId || '',
        status: currentDelivery.status,
        liters: currentDelivery.quantity,
        milkType: subscription?.planName || 'Pure Fresh A2 Cow Milk',
        timeSlot: currentDelivery.timeSlot || subscription?.deliveryTimeSlot || '',
        eta: currentDelivery.eta,
        agentName: '',
        farmerName: currentBatch?.farmName || currentBatch?.farmerName || '',
        farmLocation: currentBatch?.farmLocation || '',
        qualityDetails: currentBatch?.qualityTest ? {
          fat: `${currentBatch.qualityTest.fatPercentage}%`,
          snf: `${currentBatch.qualityTest.snfPercentage}%`,
          lactometer: currentBatch.qualityTest.lactometerReading,
          temperature: `${currentBatch.qualityTest.temperature}°C`,
          purity: 'Quality tested',
          qualityScore: currentBatch.qualityTest.qualityScore,
          qualityStatus: currentBatch.qualityTest.qualityStatus,
          testedAt: currentBatch.qualityTest.testedAt,
          testedBy: currentBatch.qualityTest.testedBy
        } : null
      } : null,
      history: deliveries,
      pagination: paginationResult(page, limit, totalItems)
    });
  } catch (error) {
    console.error('Error loading consumer dashboard:', error);
    return res.status(500).json({ success: false, message: 'Unable to load consumer dashboard.' });
  }
});

router.get('/products', (req, res) =>
  res.json({ success: true, count: products.length, products }));

router.put('/settings', async (req, res) => {
  try {
    const { address, deliveryTimeSlot } = req.body;
    const updates = {};
    if (typeof address === 'string') updates.address = address.trim();
    const consumer = await User.findByIdAndUpdate(req.user.id, { $set: updates }, {
      returnDocument: 'after',
      runValidators: true
    });
    if (!consumer) return res.status(404).json({ success: false, message: 'Consumer account not found.' });
    if (typeof deliveryTimeSlot === 'string') {
      await Subscription.updateOne(
        { consumerId: req.user.id, status: { $in: ['Active', 'Paused'] } },
        { $set: { deliveryTimeSlot: deliveryTimeSlot.trim() } }
      );
    }
    return res.json({ success: true, message: 'Delivery settings saved.', consumer: consumer.toAuthJSON() });
  } catch (error) {
    console.error('Error updating consumer settings:', error);
    return res.status(500).json({ success: false, message: 'Unable to update consumer settings.' });
  }
});

router.post('/subscription', async (req, res) => {
  try {
    const { plan, quantity, productType, deliveryTime } = req.body;
    const dailyLiters = Number(quantity ?? 2);
    if (!Number.isFinite(dailyLiters) || dailyLiters <= 0 || dailyLiters > 50) {
      return res.status(400).json({ success: false, message: 'Daily quantity must be between 0 and 50 liters.' });
    }
    const now = new Date();
    const totalDays = 30;
    const subscriptionId = `SUB-${crypto.randomUUID()}`;
    const user = await User.findById(req.user.id).select('address');
    if (!user) return res.status(404).json({ success: false, message: 'Consumer account not found.' });
    let subscription = await getCurrentSubscription(req.user.id);
    if (!subscription) {
      subscription = new Subscription({
        subscriptionId,
        consumerId: req.user.id
      });
    }
    subscription.planName = productType || products[0].name;
    subscription.planType = plan || 'Daily';
    subscription.dailyLiters = dailyLiters;
    subscription.totalDays = totalDays;
    subscription.daysRemaining = totalDays;
    subscription.status = 'Active';
    subscription.schedule = plan || 'Daily';
    subscription.pricePerLiter = products[0].price;
    subscription.deliveryTimeSlot = deliveryTime || '6:30 AM - 7:30 AM';
    subscription.deliveryAddress = user.address;
    subscription.startDate = now;
    subscription.endDate = new Date(now.getTime() + totalDays * 86400000);
    await subscription.save();
    return res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully!',
      subscription: formatSubscription(subscription)
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({ success: false, message: 'Unable to create subscription.' });
  }
});

async function setSubscriptionStatus(req, res, status) {
  try {
    const current = await getCurrentSubscription(req.user.id);
    if (!current) return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
    if (current.status === status) {
      return res.json({
        success: true,
        message: `Subscription is already ${status.toLowerCase()}.`,
        subscription: formatSubscription(current),
        unchanged: true
      });
    }
    if ((status === 'Paused' && current.status !== 'Active') ||
        (status === 'Active' && current.status !== 'Paused')) {
      return res.status(409).json({ success: false, message: `Subscription cannot be changed from ${current.status}.` });
    }

    const now = new Date();
    const updates = status === 'Paused'
      ? { status, pauseStartDate: now, pauseEndDate: null }
      : { status, resumeDate: now, pauseStartDate: null, pauseEndDate: null };
    const subscription = await Subscription.findOneAndUpdate(
      { _id: current._id, consumerId: req.user.id, status: status === 'Paused' ? 'Active' : 'Paused' },
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );
    if (!subscription) {
      const latest = await getCurrentSubscription(req.user.id);
      if (latest?.status === status) {
        return res.json({
          success: true,
          message: `Subscription is already ${status.toLowerCase()}.`,
          subscription: formatSubscription(latest),
          unchanged: true
        });
      }
      return res.status(409).json({ success: false, message: 'Subscription changed; refresh and retry.' });
    }
    await createNotification({
      userId: req.user.id,
      role: 'consumer',
      title: `Subscription ${status}`,
      message: `Your milk subscription has been ${status.toLowerCase()}.`,
      type: status === 'Active' ? 'success' : 'warning'
    });
    return res.json({
      success: true,
      message: `Subscription successfully ${status.toLowerCase()}!`,
      subscription: formatSubscription(subscription)
    });
  } catch (error) {
    console.error(`Error setting subscription ${status.toLowerCase()}:`, error);
    return res.status(500).json({ success: false, message: 'Unable to update subscription.' });
  }
}

router.post('/pause-subscription', async (req, res) => {
  try {
    const subscription = await getCurrentSubscription(req.user.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
    return setSubscriptionStatus(req, res, subscription.status === 'Active' ? 'Paused' : 'Active');
  } catch (error) {
    console.error('Error toggling consumer subscription:', error);
    return res.status(500).json({ success: false, message: 'Unable to update subscription.' });
  }
});

router.post('/subscription/pause', (req, res) => setSubscriptionStatus(req, res, 'Paused'));
router.post('/subscription/resume', (req, res) => setSubscriptionStatus(req, res, 'Active'));

router.post('/update-quantity', async (req, res) => {
  try {
    const dailyLiters = Number(req.body.dailyLiters);
    if (!Number.isFinite(dailyLiters) || dailyLiters <= 0 || dailyLiters > 50) {
      return res.status(400).json({ success: false, message: 'Daily quantity must be between 0 and 50 liters.' });
    }
    const subscription = await getCurrentSubscription(req.user.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
    subscription.dailyLiters = dailyLiters;
    await subscription.save();
    return res.json({
      success: true,
      message: `Daily milk quantity updated to ${dailyLiters} Liters/day.`,
      subscription: formatSubscription(subscription)
    });
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    return res.status(500).json({ success: false, message: 'Unable to update subscription quantity.' });
  }
});

router.post('/renew-subscription', async (req, res) => {
  try {
    const planDays = Number.parseInt(req.body.planDays, 10) || 30;
    if (planDays < 1 || planDays > 365) {
      return res.status(400).json({ success: false, message: 'Subscription length must be between 1 and 365 days.' });
    }
    const subscription = await getCurrentSubscription(req.user.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Consumer subscription not found.' });
    const now = new Date();
    subscription.daysRemaining = planDays;
    subscription.totalDays = planDays;
    subscription.status = 'Active';
    subscription.startDate = now;
    subscription.endDate = new Date(now.getTime() + planDays * 86400000);
    await subscription.save();
    await createNotification({
      userId: req.user.id,
      role: 'consumer',
      title: 'Subscription Renewed',
      message: `Your ${planDays}-day subscription was renewed.`,
      type: 'success'
    });
    return res.json({
      success: true,
      message: `Subscription renewed successfully for ${planDays} days!`,
      subscription: formatSubscription(subscription)
    });
  } catch (error) {
    console.error('Error renewing subscription:', error);
    return res.status(500).json({ success: false, message: 'Unable to renew subscription.' });
  }
});

router.post('/simulate-delivery-day', async (req, res) => {
  try {
    const now = typeof req.app.locals.testClock === 'function'
      ? new Date(req.app.locals.testClock())
      : new Date();
    const scheduledDate = normalizeScheduleDate(now);
    const subscription = await getCurrentSubscription(req.user.id);
    if (!subscription || subscription.status !== 'Active') {
      const existingToday = await Delivery.findOne({
        consumerId: req.user.id,
        subscriptionId: { $ne: '' },
        scheduledDate
      });
      if (existingToday) {
        return res.json({
          success: true,
          message: 'This subscription delivery was already recorded for today.',
          delivery: existingToday,
          daysRemaining: 0,
          status: 'Expired',
          duplicate: true
        });
      }
      return res.status(409).json({ success: false, message: 'No active subscription delivery is due.' });
    }
    const existingDelivery = await Delivery.findOne({
      subscriptionId: subscription.subscriptionId,
      scheduledDate
    });
    if (existingDelivery) {
      return res.json({
        success: true,
        message: 'This subscription delivery was already recorded for today.',
        delivery: existingDelivery,
        daysRemaining: subscription.daysRemaining,
        status: subscription.status,
        duplicate: true
      });
    }
    if (!isSubscriptionScheduledForDate(subscription, scheduledDate)) {
      return res.status(409).json({ success: false, message: 'Today is not a scheduled delivery day for this subscription.' });
    }
    const result = await withMongoTransaction(async session => {
      const existingInTransaction = await Delivery.findOne({
        subscriptionId: subscription.subscriptionId,
        scheduledDate
      }).session(session);
      if (existingInTransaction) {
        const current = await Subscription.findById(subscription._id).session(session);
        return { delivery: existingInTransaction, subscription: current, duplicate: true };
      }

      const current = await Subscription.findOne({
        _id: subscription._id,
        consumerId: req.user.id,
        status: 'Active',
        daysRemaining: { $gt: 0 },
        lastDeliveryDate: { $ne: scheduledDate }
      }).session(session);
      if (!current) {
        const recorded = await Delivery.findOne({
          subscriptionId: subscription.subscriptionId,
          scheduledDate
        }).session(session);
        if (recorded) {
          const latestSub = await Subscription.findById(subscription._id).session(session);
          return { delivery: recorded, subscription: latestSub, duplicate: true };
        }
        return null;
      }
      const user = await User.findById(req.user.id).select('address').session(session);
      if (!user) throw new Error('Consumer account is unavailable.');

      const updatedSubscription = await Subscription.findOneAndUpdate({
        _id: current._id,
        consumerId: req.user.id,
        status: 'Active',
        daysRemaining: current.daysRemaining,
        lastDeliveryDate: { $ne: scheduledDate }
      }, {
        $inc: { daysRemaining: -1 },
        $set: {
          lastDeliveryDate: scheduledDate,
          ...(current.daysRemaining === 1 ? { status: 'Expired' } : {})
        }
      }, { returnDocument: 'after', session });
      if (!updatedSubscription) return null;

      const [delivery] = await Delivery.create([{
        deliveryId: `DEL-${crypto.randomUUID()}`,
        consumerId: req.user.id,
        subscriptionId: current.subscriptionId,
        scheduledDate,
        deliveryAddress: current.deliveryAddress || user.address,
        quantity: current.dailyLiters,
        timeSlot: current.deliveryTimeSlot,
        status: 'Delivered',
        deliveredAt: now,
        tracking: [{ status: 'Delivered', changedAt: now, changedBy: req.user.id }]
      }], { session, ordered: true });
      await createNotification({
        userId: req.user.id,
        role: 'consumer',
        title: 'Milk Delivered',
        message: `Today's ${current.dailyLiters}L delivery is recorded. ${updatedSubscription.daysRemaining} days remain.`,
        type: 'info',
        session
      });
      return { delivery, subscription: updatedSubscription, duplicate: false };
    });
    if (!result) {
      const latest = await getCurrentSubscription(req.user.id);
      if (!latest || latest.status !== 'Active') {
        return res.status(409).json({ success: false, message: 'The subscription is paused, expired, or has no delivery days remaining.' });
      }
      return res.status(409).json({ success: false, message: 'A delivery was already recorded for this subscription today.' });
    }
    return res.json({
      success: true,
      message: result.duplicate
        ? 'This subscription delivery was already recorded for today.'
        : 'Delivery recorded and subscription day deducted.',
      delivery: result.delivery,
      daysRemaining: result.subscription.daysRemaining,
      status: result.subscription.status,
      ...(result.duplicate ? { duplicate: true } : {})
    });
  } catch (error) {
    return respondToDatabaseWriteError(res, error, 'Unable to record delivery.');
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [orders, totalItems] = await Promise.all([
      Order.find({ consumerId: req.user.id }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({ consumerId: req.user.id })
    ]);
    return res.json({ success: true, orders, pagination: paginationResult(page, limit, totalItems) });
  } catch (error) {
    console.error('Error loading consumer order history:', error);
    return res.status(500).json({ success: false, message: 'Unable to load orders.' });
  }
});

router.post('/order', async (req, res) => {
  let idempotencyKey;
  let requestHash;
  try {
    const { items, deliveryAddress, paymentMethod, deliveryDate } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ success: false, message: 'Select at least one valid product.' });
    }
    const orderItems = [];
    for (const item of items) {
      const product = products.find(candidate => candidate.id === item.productId);
      const quantity = Number(item.quantity);
      if (!product || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100) {
        return res.status(400).json({ success: false, message: 'Order contains an invalid product or quantity.' });
      }
      orderItems.push({
        productId: product.id,
        name: product.name,
        quantity,
        price: product.price,
        total: product.price * quantity
      });
    }
    const user = await User.findById(req.user.id).select('address');
    const address = typeof deliveryAddress === 'string' ? deliveryAddress.trim() : user?.address;
    if (!address) return res.status(400).json({ success: false, message: 'A delivery address is required.' });
    const deliveryWhen = deliveryDate ? new Date(deliveryDate) : new Date(Date.now() + 86400000);
    if (Number.isNaN(deliveryWhen.getTime())) {
      return res.status(400).json({ success: false, message: 'A valid delivery date is required.' });
    }
    idempotencyKey = getIdempotencyKey(req, req.user.id, 'consumer-order');
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: 'A valid Idempotency-Key header is required.' });
    }
    requestHash = hashPayload({
      items: orderItems,
      deliveryAddress: address,
      paymentMethod: paymentMethod || 'UPI',
      deliveryDate: deliveryDate ? deliveryWhen.toISOString() : null
    });
    const existingOrder = await Order.findOne({ consumerId: req.user.id, idempotencyKey });
    if (existingOrder) {
      if (existingOrder.requestHash !== requestHash) {
        return res.status(409).json({ success: false, message: 'This request key was already used for a different order.' });
      }
      const existingDelivery = await Delivery.findOne({ orderId: existingOrder.orderId });
      if (!existingDelivery) {
        return res.status(503).json({ success: false, message: 'The order is being recovered; please retry shortly.' });
      }
      return res.json({
        success: true,
        message: 'Order was already placed.',
        order: existingOrder,
        delivery: existingDelivery
      });
    }
    const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);
    const orderId = `HM-ORD-${crypto.randomUUID()}`;
    const createdAt = new Date();
    const { order, delivery } = await withMongoTransaction(async session => {
      const [createdOrder] = await Order.create([{
        orderId,
        consumerId: req.user.id,
        idempotencyKey,
        requestHash,
        items: orderItems,
        quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        price: totalAmount / orderItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount,
        deliveryDate: deliveryWhen,
        deliveryAddress: address,
        paymentMethod: paymentMethod || 'UPI',
        status: 'Confirmed',
        tracking: [{ status: 'Confirmed', changedAt: createdAt, changedBy: req.user.id }]
      }], { session, ordered: true });
      const [createdDelivery] = await Delivery.create([{
        deliveryId: `DEL-${crypto.randomUUID()}`,
        consumerId: req.user.id,
        orderId,
        deliveryAddress: address,
        quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        status: 'Pending',
        tracking: [{ status: 'Pending', changedAt: createdAt, changedBy: req.user.id }]
      }], { session, ordered: true });
      await createNotification({
        userId: req.user.id,
        role: 'consumer',
        title: 'Order Confirmed',
        message: `Order ${orderId} was placed successfully.`,
        type: 'success',
        session
      });
      return { order: createdOrder, delivery: createdDelivery };
    });
    return res.status(201).json({ success: true, message: 'Order placed successfully!', order, delivery });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const existingOrder = await Order.findOne({ consumerId: req.user.id, idempotencyKey });
      if (existingOrder?.requestHash === requestHash) {
        const existingDelivery = await Delivery.findOne({ orderId: existingOrder.orderId });
        if (existingDelivery) {
          return res.json({
            success: true,
            message: 'Order was already placed.',
            order: existingOrder,
            delivery: existingDelivery
          });
        }
      }
      return res.status(409).json({ success: false, message: 'This request key was already used for another order.' });
    }
    return respondToDatabaseWriteError(res, error, 'Unable to place order.');
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/authMiddleware');
const { getPagination, paginationResult } = require('../utils/pagination');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = req.user.role === 'admin'
      ? { $or: [{ userId: req.user.id }, { role: 'admin' }] }
      : { userId: req.user.id };
    const unreadFilter = req.user.role === 'admin'
      ? { read: false, $or: [{ userId: req.user.id }, { role: 'admin' }] }
      : { userId: req.user.id, read: false };
    const [notifications, totalItems, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments(unreadFilter)
    ]);
    return res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: paginationResult(page, limit, totalItems)
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
  }
});

router.post('/mark-read', async (req, res) => {
  try {
    const { notifId } = req.body;
    if (!notifId) return res.status(400).json({ success: false, message: 'A notification ID is required.' });
    const updated = await Notification.findOneAndUpdate(
      req.user.role === 'admin'
        ? { _id: notifId, $or: [{ userId: req.user.id }, { role: 'admin' }] }
        : { _id: notifId, userId: req.user.id },
      { $set: { read: true } },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return res.status(500).json({ success: false, message: 'Unable to update notification.' });
  }
});

router.put('/mark-all-read', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      req.user.role === 'admin'
        ? { read: false, $or: [{ userId: req.user.id }, { role: 'admin' }] }
        : { userId: req.user.id, read: false },
      { $set: { read: true } }
    );
    return res.json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return res.status(500).json({ success: false, message: 'Unable to update notifications.' });
  }
});

module.exports = router;

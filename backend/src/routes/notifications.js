const express = require('express');
const router = express.Router();
const { notifications } = require('../store');

// GET /api/notifications?userId=
router.get('/', (req, res) => {
  const { userId } = req.query;
  const userNotifs = notifications.filter(n => !userId || n.userId === userId || n.userId === 'all');
  
  return res.json({
    success: true,
    notifications: userNotifs,
    unreadCount: userNotifs.filter(n => !n.read).length
  });
});

// POST /api/notifications/mark-read
router.post('/mark-read', (req, res) => {
  const { userId, notifId } = req.body;

  if (notifId) {
    const notif = notifications.find(n => n.id === notifId);
    if (notif) notif.read = true;
  } else if (userId) {
    notifications.filter(n => n.userId === userId || n.userId === 'all').forEach(n => n.read = true);
  }

  return res.json({ success: true, message: 'Notifications marked as read.' });
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', (req, res) => {
  const { userId } = req.body;
  notifications.filter(n => !userId || n.userId === userId || n.userId === 'all').forEach(n => n.read = true);
  return res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = router;

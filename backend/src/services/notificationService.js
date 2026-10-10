const Notification = require('../models/Notification');

function createNotification({ userId, role = '', title, message, type = 'info', session }) {
  const notification = {
    userId: String(userId),
    role,
    title,
    message,
    type
  };
  return session
    ? Notification.create([notification], { session, ordered: true }).then(([created]) => created)
    : Notification.create(notification);
}

module.exports = { createNotification };

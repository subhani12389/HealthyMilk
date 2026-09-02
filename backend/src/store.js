const supabase = require('./supabase');

// HealthyMilk Production Store (Clean initial store without demo accounts)
const users = [];

const milkLogs = [];

const consumerDeliveries = [];

const transactions = [];

const notifications = [];

// Temporary In-Memory OTP Store: key = cleanPhone, value = { otp, expiresAt, verified }
const otpStore = new Map();

module.exports = {
  supabase,
  users,
  milkLogs,
  consumerDeliveries,
  deliveryTasks: consumerDeliveries,
  transactions,
  notifications,
  otpStore
};

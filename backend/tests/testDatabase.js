require('dotenv').config();
const crypto = require('crypto');

const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const OtpChallenge = require('../src/models/OtpChallenge');
const EmailOtpChallenge = require('../src/models/EmailOtpChallenge');
const MilkBatch = require('../src/models/MilkBatch');
const Transaction = require('../src/models/Transaction');
const Order = require('../src/models/Order');
const Subscription = require('../src/models/Subscription');
const Delivery = require('../src/models/Delivery');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');

async function prepareTestDatabase() {
  const testUri = process.env.MONGODB_TEST_URI;
  if (!testUri) {
    throw new Error('Set MONGODB_TEST_URI to a dedicated MongoDB test database before running E2E tests.');
  }

  let databaseName;
  try {
    databaseName = new URL(testUri).pathname.replace(/^\//, '').split('?')[0];
  } catch {
    throw new Error('MONGODB_TEST_URI must be a valid MongoDB connection string.');
  }
  if (!databaseName.toLowerCase().endsWith('_test')) {
    throw new Error('MONGODB_TEST_URI must target a database whose name ends with "_test".');
  }

  process.env.MONGODB_URI = testUri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
  await connectDB();
  try {
    await User.collection.dropIndex('phoneNumber_1');
  } catch (e) {}
  try {
    await User.syncIndexes();
  } catch (e) {}
  await Promise.all([
    User.deleteMany({}),
    OtpChallenge.deleteMany({}),
    EmailOtpChallenge.deleteMany({}),
    MilkBatch.deleteMany({}),
    Transaction.deleteMany({}),
    Order.deleteMany({}),
    Subscription.deleteMany({}),
    Delivery.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({})
  ]);
}

module.exports = { prepareTestDatabase };

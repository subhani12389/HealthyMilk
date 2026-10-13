const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const MilkBatch = require('../src/models/MilkBatch');
const Transaction = require('../src/models/Transaction');
const Order = require('../src/models/Order');
const Subscription = require('../src/models/Subscription');
const Delivery = require('../src/models/Delivery');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const OtpChallenge = require('../src/models/OtpChallenge');
const EmailOtpChallenge = require('../src/models/EmailOtpChallenge');

async function resetData() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthymilk';
  console.log(`Connecting to MongoDB at: ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  console.log('Clearing database collections...');
  await Promise.all([
    MilkBatch.deleteMany({}),
    Transaction.deleteMany({}),
    Order.deleteMany({}),
    Subscription.deleteMany({}),
    Delivery.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    OtpChallenge.deleteMany({}),
    EmailOtpChallenge.deleteMany({})
  ]);
  console.log('Cleared all batches, transactions, orders, subscriptions, deliveries, notifications, and OTP challenges.');

  // Delete all users to start completely fresh
  await User.deleteMany({});
  console.log('Cleared all user accounts.');

  // Seed standard verified demo accounts with secure bcrypt hashes
  const salt = 10;
  const demoAccounts = [
    {
      name: 'Ramesh Patel (Farmer)',
      email: 'farmer@healthymilk.com',
      passwordHash: await bcrypt.hash('Farmer@123', salt),
      role: 'farmer',
      farmName: "Green Valley Organic Dairy Farm",
      location: 'Kaira Valley, Anand',
      cattleCount: 24,
      balance: 15400,
      isEmailVerified: true,
      isActive: true
    },
    {
      name: 'Ananya Sharma (Consumer)',
      email: 'consumer@healthymilk.com',
      passwordHash: await bcrypt.hash('Consumer@123', salt),
      role: 'consumer',
      address: 'Apt 402, Green Acres Heights, Sector 14',
      isEmailVerified: true,
      isActive: true
    },
    {
      name: 'Vikram Singh (Delivery Agent)',
      email: 'agent@healthymilk.com',
      passwordHash: await bcrypt.hash('Agent@123', salt),
      role: 'delivery_agent',
      vehicleNo: 'GJ-07-MK-4421',
      assignedArea: 'Sector 14 & Green Valley',
      balance: 3250,
      isEmailVerified: true,
      isActive: true
    },
    {
      name: 'System Administrator',
      email: 'admin@healthymilk.com',
      passwordHash: await bcrypt.hash('Admin@123', salt),
      role: 'admin',
      isEmailVerified: true,
      isActive: true
    }
  ];

  for (const acc of demoAccounts) {
    const userDoc = await User.create(acc);
    if (acc.role === 'consumer') {
      // Auto-create initial active subscription for consumer demo account
      const startDate = new Date();
      await Subscription.create({
        subscriptionId: 'SUB-DEMO-001',
        consumerId: userDoc._id.toString(),
        planName: 'Pure Fresh A2 Cow Milk',
        planType: 'Daily',
        dailyLiters: 2,
        totalDays: 30,
        daysRemaining: 28,
        status: 'Active',
        schedule: 'Daily',
        pricePerLiter: 65,
        totalAmountPaid: 3900,
        deliveryTimeSlot: '6:30 AM - 7:30 AM',
        deliveryAddress: acc.address,
        startDate: startDate,
        endDate: new Date(startDate.getTime() + 30 * 86400000)
      });
    }
  }

  console.log('\n===============================================================');
  console.log('✅ HealthyMilk Database Reset Complete!');
  console.log('---------------------------------------------------------------');
  console.log('Pre-configured verified demo accounts:');
  console.log('🧑‍🌾 Farmer:         farmer@healthymilk.com   (Password: Farmer@123)');
  console.log('🥛 Consumer:       consumer@healthymilk.com (Password: Consumer@123)');
  console.log('🚚 Delivery Agent: agent@healthymilk.com    (Password: Agent@123)');
  console.log('🛡️ Admin:          admin@healthymilk.com    (Password: Admin@123)');
  console.log('---------------------------------------------------------------');
  console.log('You can also register ANY new email with full Email OTP verification!');
  console.log('===============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

resetData().catch(err => {
  console.error('Error resetting database:', err);
  process.exit(1);
});

const supabase = require('./supabase');

// HealthyMilk Supabase Database Store & In-Memory Cache
const users = [
  {
    id: 'farmer_1',
    name: 'Ramesh Patel',
    email: 'farmer@healthymilk.com',
    password: 'password123',
    role: 'farmer',
    farmName: 'Patel Dairy Farm',
    location: 'Kaira Valley, Anand',
    cattleCount: 24,
    bankDetails: {
      accountNo: 'XXXX-XXXX-8921',
      ifsc: 'SBIN0004123',
      bankName: 'State Bank of India'
    },
    balance: 14250.00,
    rating: 4.9,
    createdAt: new Date().toISOString()
  },
  {
    id: 'agent_1',
    name: 'John Doe',
    email: 'agent@healthymilk.com',
    password: 'password123',
    role: 'agent',
    assignedArea: 'Sector 14 & Green Valley',
    vehicleNo: 'GJ-07-MK-4421',
    phone: '+91 91234 56789',
    status: 'Active',
    balance: 3450.00,
    totalDeliveries: 69,
    commissionRate: 50,
    bankDetails: {
      accountNo: 'XXXX-XXXX-3341',
      ifsc: 'HDFC0001290',
      bankName: 'HDFC Bank'
    },
    createdAt: new Date().toISOString()
  },
  {
    id: 'consumer_1',
    name: 'Priya Sharma',
    email: 'consumer@healthymilk.com',
    password: 'password123',
    role: 'consumer',
    address: 'Apt 402, Green Acres Heights, Sector 14',
    phone: '+91 98765 43210',
    subscription: {
      id: 'sub_1',
      planName: 'Pure Fresh A2 Cow Milk',
      dailyLiters: 2,
      totalDays: 30,
      daysRemaining: 22,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'Active',
      pricePerLiter: 65,
      totalAmountPaid: 3900,
      deliveryTimeSlot: '6:30 AM - 7:30 AM'
    },
    createdAt: new Date().toISOString()
  }
];

const milkLogs = [
  {
    id: 'batch_101',
    farmerId: 'farmer_1',
    farmerName: 'Patel Dairy Farm',
    liters: 50,
    notes: 'Fresh morning batch in 2 chilled cans',
    fatPercentage: 4.5,
    snfPercentage: 8.8,
    ratePerLiter: 52,
    totalPrice: 2600,
    status: 'Collected & Credited',
    dateStr: '12 Aug 2026',
    agentName: 'John Doe',
    timestamp: new Date().toISOString()
  },
  {
    id: 'batch_102',
    farmerId: 'farmer_1',
    farmerName: 'Patel Dairy Farm',
    liters: 60,
    notes: 'Evening collection batch ready',
    fatPercentage: 0,
    snfPercentage: 0,
    ratePerLiter: 0,
    totalPrice: 0,
    status: 'Pickup Requested',
    dateStr: '12 Aug 2026',
    agentName: 'John Doe',
    timestamp: new Date().toISOString()
  }
];

const consumerDeliveries = [
  {
    id: 'deliv_201',
    consumerId: 'consumer_1',
    consumerName: 'Priya Sharma',
    address: 'Apt 402, Green Acres Heights',
    liters: 2,
    milkType: 'Pure Fresh A2 Cow Milk',
    eta: '07:15 AM',
    agentName: 'John Doe',
    status: 'Out for Delivery',
    dateStr: '12 Aug 2026'
  }
];

const transactions = [
  {
    id: 'tx_901',
    userId: 'farmer_1',
    reference: 'PAYOUT-SBI-9921',
    type: 'Bank Payout Withdrawal',
    amount: 5000,
    status: 'Completed',
    date: '10 Aug 2026'
  },
  {
    id: 'tx_902',
    userId: 'farmer_1',
    reference: 'MILK-CREDIT-101',
    type: 'Milk Deposit Credit (50L @ ₹52)',
    amount: 2600,
    status: 'Completed',
    date: '12 Aug 2026'
  },
  {
    id: 'tx_903',
    userId: 'agent_1',
    reference: 'FEE-CREDIT-101',
    type: 'Collection & Quality Fee Credit',
    amount: 50,
    status: 'Completed',
    date: '12 Aug 2026'
  }
];

const notifications = [
  {
    id: 'notif_1',
    title: 'Pickup Requested',
    message: 'Farmer Ramesh Patel requested pickup for 60L milk.',
    time: '10 mins ago',
    unread: true
  },
  {
    id: 'notif_2',
    title: 'Payment Credited',
    message: '₹2,600 credited to Ramesh Patel for Batch #101.',
    time: '1 hour ago',
    unread: false
  }
];

module.exports = {
  supabase,
  users,
  milkLogs,
  consumerDeliveries,
  deliveryTasks: consumerDeliveries,
  transactions,
  notifications
};

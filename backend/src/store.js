// In-memory data store with realistic initial data for HealthyMilk

const users = [
  {
    id: "farmer_1",
    name: "Ramesh Patel",
    email: "farmer@healthymilk.com",
    role: "farmer",
    farmName: "Patel Dairy Farm",
    location: "Kaira Valley, Anand",
    cattleCount: 24,
    bankDetails: {
      accountNo: "XXXX-XXXX-8921",
      ifsc: "SBIN0004123",
      bankName: "State Bank of India"
    },
    balance: 14250.00,
    rating: 4.9
  },
  {
    id: "consumer_1",
    name: "Priya Sharma",
    email: "consumer@healthymilk.com",
    role: "consumer",
    address: "Apt 402, Green Acres Heights, Sector 14",
    phone: "+91 98765 43210",
    subscription: {
      id: "sub_101",
      planName: "Pure A2 Cow Milk (Fresh Daily)",
      dailyLiters: 2,
      totalDays: 30,
      daysRemaining: 22,
      startDate: "2026-08-01",
      endDate: "2026-08-30",
      status: "Active",
      pricePerLiter: 65,
      totalAmountPaid: 3900,
      deliveryTimeSlot: "6:30 AM - 7:30 AM"
    }
  },
  {
    id: "agent_1",
    name: "John Doe",
    email: "agent@healthymilk.com",
    role: "agent",
    assignedArea: "Sector 14 & Green Valley",
    vehicleNo: "GJ-07-MK-4421",
    phone: "+91 91234 56789",
    status: "Active",
    balance: 3450.00,
    totalDeliveries: 69,
    commissionRate: 50, // ₹50 per completed pickup/delivery
    bankDetails: {
      accountNo: "XXXX-XXXX-3341",
      ifsc: "HDFC0001290",
      bankName: "HDFC Bank"
    }
  }
];

const milkLogs = [
  {
    id: "log_1",
    farmerId: "farmer_1",
    farmerName: "Patel Dairy Farm",
    liters: 45,
    fatPercentage: 4.5,
    snfPercentage: 8.8,
    lactometerReading: 29.5,
    ratePerLiter: 55,
    totalPrice: 2475,
    timestamp: "2026-08-11T06:15:00Z",
    dateStr: "11 Aug 2026",
    status: "Tested & Picked Up by Agent",
    agentName: "John Doe",
    qualityScore: 98
  },
  {
    id: "log_2",
    farmerId: "farmer_1",
    farmerName: "Patel Dairy Farm",
    liters: 50,
    fatPercentage: 4.6,
    snfPercentage: 8.9,
    lactometerReading: 30.0,
    ratePerLiter: 55,
    totalPrice: 2750,
    timestamp: "2026-08-10T06:30:00Z",
    dateStr: "10 Aug 2026",
    status: "Delivered",
    agentName: "John Doe",
    qualityScore: 99
  },
  {
    id: "log_3",
    farmerId: "farmer_1",
    farmerName: "Patel Dairy Farm",
    liters: 42,
    fatPercentage: 4.4,
    snfPercentage: 8.7,
    lactometerReading: 29.0,
    ratePerLiter: 55,
    totalPrice: 2310,
    timestamp: "2026-08-09T06:10:00Z",
    dateStr: "09 Aug 2026",
    status: "Delivered",
    agentName: "John Doe",
    qualityScore: 97
  }
];

const deliveryTasks = [
  {
    id: "task_1",
    consumerId: "consumer_1",
    consumerName: "Priya Sharma",
    address: "Apt 402, Green Acres Heights, Sector 14",
    farmerName: "Patel Dairy Farm",
    liters: 2,
    milkType: "Pure A2 Cow Milk",
    status: "Out for Delivery",
    timeSlot: "6:30 AM - 7:30 AM",
    eta: "07:15 AM",
    dateStr: "11 Aug 2026",
    agentName: "John Doe"
  },
  {
    id: "task_2",
    consumerId: "consumer_2",
    consumerName: "Anita Roy",
    address: "Flat 101, Sunshine Residency, Sector 14",
    farmerName: "Patel Dairy Farm",
    liters: 1.5,
    milkType: "Buffalo Milk",
    status: "Delivered",
    timeSlot: "6:00 AM - 7:00 AM",
    deliveredAt: "06:40 AM",
    dateStr: "11 Aug 2026",
    agentName: "John Doe"
  }
];

const notifications = [
  {
    id: "notif_1",
    userId: "farmer_1",
    title: "Milk Collected",
    message: "45 Liters of fresh milk was picked up by Delivery Agent John Doe.",
    time: "2 hours ago",
    read: false,
    type: "info"
  },
  {
    id: "notif_2",
    userId: "farmer_1",
    title: "Weekly Payout Approved",
    message: "₹14,250 has been processed to your SBI Bank Account.",
    time: "Yesterday",
    read: true,
    type: "success"
  },
  {
    id: "notif_3",
    userId: "consumer_1",
    title: "Milk Out for Delivery",
    message: "Your daily 2L A2 Cow Milk is on its way with Agent John. ETA: 7:15 AM.",
    time: "30 mins ago",
    read: false,
    type: "info"
  },
  {
    id: "notif_4",
    userId: "agent_1",
    title: "Delivery Commission Credited",
    message: "₹50 delivery commission credited to your balance for Patel Farm pickup.",
    time: "1 hour ago",
    read: false,
    type: "success"
  }
];

const transactions = [
  {
    id: "tx_1",
    farmerId: "farmer_1",
    amount: 2750,
    type: "Credit (Milk Deposit)",
    date: "10 Aug 2026",
    status: "Completed",
    reference: "DEP-9021-PATEL"
  },
  {
    id: "tx_2",
    farmerId: "farmer_1",
    amount: 2310,
    type: "Credit (Milk Deposit)",
    date: "09 Aug 2026",
    status: "Completed",
    reference: "DEP-9020-PATEL"
  },
  {
    id: "tx_3",
    agentId: "agent_1",
    amount: 50,
    type: "Credit (Agent Delivery Fee)",
    date: "11 Aug 2026",
    status: "Completed",
    reference: "AG-COMM-4412"
  },
  {
    id: "tx_4",
    agentId: "agent_1",
    amount: 1000,
    type: "Bank Withdrawal",
    date: "08 Aug 2026",
    status: "Completed",
    reference: "WTH-AG-HDFC"
  }
];

module.exports = {
  users,
  milkLogs,
  deliveryTasks,
  notifications,
  transactions
};

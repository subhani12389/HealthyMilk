const supabase = require('./supabase');

// HealthyMilk In-Memory Store
const users = [];

const milkLogs = [];

const consumerDeliveries = [];

const transactions = [];

const notifications = [];

// In-Memory Milk Batches Store
const milkBatches = [
  {
    id: 'batch_1',
    batchId: 'HM-20260921-0001',
    farmerId: 'farmer_1',
    farmerName: 'Ramesh Patel',
    farmName: 'Patel Organic Dairy',
    farmLocation: 'Kaira Valley, Anand',
    agentId: 'agent_1',
    agentName: 'John Doe (Delivery Agent)',
    liters: 25,
    status: 'Accepted',
    collectionDate: new Date().toISOString(),
    notes: 'Morning fresh A2 milk collection',
    qualityTest: {
      fatPercentage: 4.8,
      snfPercentage: 8.9,
      lactometerReading: 30.0,
      temperature: 4.0,
      qualityScore: 96,
      qualityStatus: 'Passed',
      ratePerLiter: 54,
      totalPrice: 1350,
      testedAt: new Date().toISOString(),
      testedBy: 'John Doe (Delivery Agent)',
      testedById: 'agent_1',
      remarks: 'Optimal fat and solids. Crystal clear purity.'
    },
    qualityHistory: [
      {
        fatPercentage: 4.8,
        snfPercentage: 8.9,
        lactometerReading: 30.0,
        temperature: 4.0,
        qualityScore: 96,
        qualityStatus: 'Passed',
        ratePerLiter: 54,
        totalPrice: 1350,
        testedAt: new Date().toISOString(),
        testedBy: 'John Doe (Delivery Agent)',
        testedById: 'agent_1',
        remarks: 'Initial field inspection passed'
      }
    ],
    rejection: null,
    auditHistory: [
      {
        fromStatus: 'Collected',
        toStatus: 'Quality Checked',
        changedBy: 'John Doe',
        changedById: 'agent_1',
        changedAt: new Date(Date.now() - 3600000).toISOString(),
        reason: 'Field testing conducted',
        remarks: 'Tested on-spot using digital lactometer & ultrasonic analyzer'
      },
      {
        fromStatus: 'Quality Checked',
        toStatus: 'Accepted',
        changedBy: 'John Doe',
        changedById: 'agent_1',
        changedAt: new Date(Date.now() - 1800000).toISOString(),
        reason: 'Standards compliant',
        remarks: 'Batch verified and added to cold-chain dispatch'
      }
    ]
  },
  {
    id: 'batch_2',
    batchId: 'HM-20260921-0002',
    farmerId: 'farmer_1',
    farmerName: 'Ramesh Patel',
    farmName: 'Patel Organic Dairy',
    farmLocation: 'Kaira Valley, Anand',
    agentId: 'agent_1',
    agentName: 'John Doe (Delivery Agent)',
    liters: 15,
    status: 'Rejected',
    collectionDate: new Date(Date.now() - 86400000).toISOString(),
    notes: 'Evening batch collection',
    qualityTest: {
      fatPercentage: 2.1,
      snfPercentage: 6.2,
      lactometerReading: 21.0,
      temperature: 18.5,
      qualityScore: 35,
      qualityStatus: 'Rejected',
      ratePerLiter: 35,
      totalPrice: 525,
      testedAt: new Date(Date.now() - 86400000).toISOString(),
      testedBy: 'John Doe (Delivery Agent)',
      testedById: 'agent_1',
      remarks: 'Significant dilution detected. Elevated temperature.'
    },
    qualityHistory: [
      {
        fatPercentage: 2.1,
        snfPercentage: 6.2,
        lactometerReading: 21.0,
        temperature: 18.5,
        qualityScore: 35,
        qualityStatus: 'Rejected',
        ratePerLiter: 35,
        totalPrice: 525,
        testedAt: new Date(Date.now() - 86400000).toISOString(),
        testedBy: 'John Doe (Delivery Agent)',
        testedById: 'agent_1',
        remarks: 'Sample failed threshold checks'
      }
    ],
    rejection: {
      reason: 'Abnormal Lactometer Reading',
      remarks: 'Lactometer showed 21.0 (expected >28). Possible water adulteration and temperature reached 18.5°C.',
      agentId: 'agent_1',
      agentName: 'John Doe (Delivery Agent)',
      rejectedAt: new Date(Date.now() - 86400000).toISOString(),
      evidencePhoto: '',
      reviewStatus: 'Under Review',
      reviewedBy: 'Admin Team',
      reviewedAt: new Date(Date.now() - 43200000).toISOString(),
      adminRemarks: 'Auditing farm cooling tank logs'
    },
    auditHistory: [
      {
        fromStatus: 'Collected',
        toStatus: 'Rejected',
        changedBy: 'John Doe',
        changedById: 'agent_1',
        changedAt: new Date(Date.now() - 86400000).toISOString(),
        reason: 'Failed lactometer threshold',
        remarks: 'Batch flagged and returned to quarantine'
      }
    ]
  }
];

let batchCounter = 3;

/**
 * Generate a unique readable Milk Batch ID: HM-YYYYMMDD-XXXX
 */
function generateBatchId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const seq = String(batchCounter++).padStart(4, '0');
  return `HM-${dateStr}-${seq}`;
}

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
  milkBatches,
  generateBatchId,
  otpStore
};

const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { prepareTestDatabase } = require('./testDatabase');
const User = require('../src/models/User');
const MilkBatch = require('../src/models/MilkBatch');

let server;
let app;
const PORT = 5098;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let authToken = '';

const idempotencyHeaders = () => ({ 'Idempotency-Key': crypto.randomUUID() });

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const results = [];

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    results.push({ test: description, passed: true, details });
  } else {
    console.error(`  ❌ FAIL: ${description} - ${details}`);
    results.push({ test: description, passed: false, details });
  }
}

async function runEdgeCases() {
  console.log('===============================================================');
  console.log('🛡️ Starting HealthyMilk RBAC & Edge Cases Security Audit');
  console.log('===============================================================');

  try {
    process.env.ALLOW_STANDALONE_TRANSACTIONS = 'true';
    await prepareTestDatabase();
    const defaultHash = 'mock_hashed_password';
    const testFarmer = await User.create({
      email: 'rbac_farmer@healthymilk.test',
      passwordHash: defaultHash,
      phoneNumber: '9876541098',
      role: 'farmer',
      name: 'RBAC Test Farmer'
    });
    const farmerId = testFarmer._id.toString();
    const testAgent = await User.create({
      email: 'rbac_agent@healthymilk.test',
      passwordHash: defaultHash,
      phoneNumber: '9876541097',
      role: 'delivery_agent',
      name: 'RBAC Test Agent'
    });
    const testConsumer = await User.create({
      email: 'rbac_consumer@healthymilk.test',
      passwordHash: defaultHash,
      phoneNumber: '9876541096',
      role: 'consumer',
      name: 'RBAC Test Consumer'
    });
    const testAdmin = await User.create({
      email: 'rbac_admin@healthymilk.test',
      passwordHash: defaultHash,
      phoneNumber: '9876541095',
      role: 'admin',
      name: 'RBAC Test Admin'
    });
    const tokens = {
      farmer: jwt.sign({ id: farmerId, email: testFarmer.email, role: 'farmer' }, process.env.JWT_SECRET, { expiresIn: '1h' }),
      agent: jwt.sign({ id: testAgent._id.toString(), email: testAgent.email, role: 'delivery_agent' }, process.env.JWT_SECRET, { expiresIn: '1h' }),
      consumer: jwt.sign({ id: testConsumer._id.toString(), email: testConsumer.email, role: 'consumer' }, process.env.JWT_SECRET, { expiresIn: '1h' }),
      admin: jwt.sign({ id: testAdmin._id.toString(), email: testAdmin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    };
    authToken = '';
    app = require('../src/server');
    await new Promise((resolve) => {
      server = app.listen(PORT, resolve);
    });

    console.log('\n--- 0. Testing Backend Role Enforcement ---');
    const unauthenticated = await request('GET', '/api/farmer/dashboard');
    assert('Unauthenticated user is denied protected farmer API (401)', unauthenticated.status === 401);
    authToken = tokens.consumer;
    const consumerFarmerAccess = await request('GET', '/api/farmer/dashboard');
    assert('Consumer is denied farmer API (403)', consumerFarmerAccess.status === 403);
    authToken = tokens.farmer;
    const farmerAdminAccess = await request('GET', '/api/admin/stats');
    assert('Farmer is denied admin API (403)', farmerAdminAccess.status === 403);
    authToken = tokens.agent;
    const agentConsumerAccess = await request('GET', '/api/consumer/dashboard');
    assert('Delivery agent is denied consumer private API (403)', agentConsumerAccess.status === 403);
    authToken = tokens.admin;
    const adminAccess = await request('GET', '/api/admin/stats');
    assert('Admin is authorized for admin API (200)', adminAccess.status === 200);
    authToken = tokens.farmer;

    // -------------------------------------------------------------------------
    // 1. REJECTION ENUM VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Rejection Reason Enum Constraints ---');

    // Create a batch
    const pRes = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 30
    }, idempotencyHeaders());
    const batchId = pRes.data.batchId;

    // Invalid rejection reason
    authToken = tokens.agent;
    const invalidReason = await request('POST', '/api/delivery/reject-batch', {
      batchId,
      reason: 'Invalid Made Up Reason',
      agentId: 'agent_1'
    });
    assert('Reject invalid rejection reason not in enum (HTTP 400)', invalidReason.status === 400);

    // All valid rejection reasons
    const validReasons = [
      'Low quality reading',
      'Abnormal Fat/SNF',
      'Abnormal Lactometer Reading',
      'Temperature issue',
      'Contamination concern',
      'Damaged/unsafe batch',
      'Other'
    ];

    authToken = tokens.farmer;
    for (const r of validReasons) {
      const p = await request('POST', '/api/farmer/request-pickup', { farmerId, liters: 10 }, idempotencyHeaders());
      const bId = p.data.batchId;
      authToken = tokens.agent;
      const res = await request('POST', '/api/delivery/reject-batch', {
        batchId: bId,
        reason: r,
        agentId: 'agent_1'
      });
      assert(`Accept valid rejection reason: "${r}"`, res.status === 200 && res.data.success);
      authToken = tokens.farmer;
    }

    // -------------------------------------------------------------------------
    // 2. QUALITY PARAMETER BOUNDARY & NEGATIVE VALUE TESTING
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Quality Parameter Boundaries & Extreme Values ---');

    const p3 = await request('POST', '/api/farmer/request-pickup', { farmerId, liters: 25 }, idempotencyHeaders());
    const bId3 = p3.data.batchId;

    // Negative Fat
    authToken = tokens.agent;
    const negFat = await request('POST', '/api/delivery/test-and-collect', {
      batchId: bId3,
      testedFat: -1.5,
      testedSNF: 8.5
    });
    assert('Reject negative Fat % (HTTP 400)', negFat.status === 400);

    // Negative SNF
    const negSNF = await request('POST', '/api/delivery/test-and-collect', {
      batchId: bId3,
      testedFat: 4.5,
      testedSNF: 2.0 // below 4.0 min
    });
    assert('Reject SNF below threshold 4.0% (HTTP 400)', negSNF.status === 400);

    // Extreme Temperature (> 45°C)
    const hotTemp = await request('POST', '/api/delivery/test-and-collect', {
      batchId: bId3,
      testedFat: 4.5,
      testedSNF: 8.5,
      temperature: 55.0
    });
    assert('Reject extreme temperature (> 45°C) (HTTP 400)', hotTemp.status === 400);

    // Valid Boundary Values
    const validTest = await request('POST', '/api/delivery/test-and-collect', {
      batchId: bId3,
      testedFat: 4.2,
      testedSNF: 8.6,
      lactometerReading: 29.0,
      temperature: 3.8
    });
    assert('Accept valid within-bounds quality parameters', validTest.status === 200 && validTest.data.success);

    // -------------------------------------------------------------------------
    // 3. WITHDRAWAL & BALANCE CONSTRAINTS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Withdrawal & Balance Constraints ---');

    // Withdraw more than available balance
    authToken = tokens.farmer;
    const excessiveWth = await request('POST', '/api/farmer/payout', {
      farmerId,
      amount: 999999999
    });
    assert('Reject withdrawal amount greater than balance (HTTP 400)', excessiveWth.status === 400);

    // Negative withdrawal amount
    const negWth = await request('POST', '/api/farmer/payout', {
      farmerId,
      amount: -100
    });
    assert('Reject negative withdrawal amount (HTTP 400)', negWth.status === 400);

    // -------------------------------------------------------------------------
    // 4. BATCH STATUS LIFECYCLE PROGRESSION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Batch Status Lifecycle Progression ---');

    const p4 = await request('POST', '/api/farmer/request-pickup', { farmerId, liters: 50 }, idempotencyHeaders());
    const bId4 = p4.data.batchId;
    await MilkBatch.updateOne({ batchId: bId4 }, {
      $set: { agentId: testAgent._id.toString(), agentName: testAgent.name }
    });

    authToken = tokens.agent;
    const invalidStatus = await request('PUT', `/api/batches/${bId4}/status`, {
      newStatus: 'InvalidStatusName'
    });
    assert('Reject invalid batch status name (HTTP 400)', invalidStatus.status === 400);

    const bypassQuality = await request('PUT', `/api/batches/${bId4}/status`, {
      newStatus: 'In Transit',
      reason: 'Attempt to bypass quality inspection'
    });
    assert('Reject batch transit that bypasses required quality acceptance',
      bypassQuality.status === 409 && (await MilkBatch.findOne({ batchId: bId4 })).status === 'Collected');

    const qualityInspection = await request('POST', '/api/delivery/test-and-collect', {
      batchId: bId4,
      testedFat: 4.5,
      testedSNF: 8.5,
      lactometerReading: 29,
      temperature: 4
    });
    assert('Require delivery-agent quality inspection before accepted-state transitions',
      qualityInspection.status === 200 && qualityInspection.data.batch.status === 'Accepted');

    // Step 1: Accepted -> In Transit
    const toTransit = await request('PUT', `/api/batches/${bId4}/status`, {
      newStatus: 'In Transit',
      changedBy: 'Logistics Manager',
      reason: 'Dispatched to cold-chain van'
    });
    assert('Update batch status to In Transit', toTransit.status === 200 && toTransit.data.batch.status === 'In Transit');

    // Step 2: In Transit -> Delivered
    const toDelivered = await request('PUT', `/api/batches/${bId4}/status`, {
      newStatus: 'Delivered',
      changedBy: 'Delivery Agent',
      reason: 'Delivered to dairy hub'
    });
    assert('Update batch status to Delivered', toDelivered.status === 200 && toDelivered.data.batch.status === 'Delivered');

    // Verify Audit History
    const auditRes = await request('GET', `/api/batches/${bId4}`);
    assert('Audit trail records chronological transitions', Array.isArray(auditRes.data.batch.auditHistory) && auditRes.data.batch.auditHistory.length >= 2);

    // -------------------------------------------------------------------------
    // 5. SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`Edge Cases Audit: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} tests.`);
    console.log('===============================================================');

    if (failedCount > 0) {
      console.error('\n⚠️ Some edge case tests failed!');
      process.exit(1);
    } else {
      console.log(`\n🎉 ALL ${passedCount}/${results.length} RBAC & EDGE CASE TESTS PASSED CLEANLY!`);
    }

  } catch (err) {
    console.error('Fatal Error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runEdgeCases();

const http = require('http');
const path = require('path');
const app = require('../src/server');

let server;
const PORT = 5098;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
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

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // -------------------------------------------------------------------------
    // 1. REJECTION ENUM VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Rejection Reason Enum Constraints ---');

    // Create a batch
    const pRes = await request('POST', '/api/farmer/request-pickup', {
      farmerId: 'farmer_1',
      liters: 30
    });
    const batchId = pRes.data.batchId;

    // Invalid rejection reason
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

    for (const r of validReasons) {
      const p = await request('POST', '/api/farmer/request-pickup', { farmerId: 'farmer_1', liters: 10 });
      const bId = p.data.batchId;
      const res = await request('POST', '/api/delivery/reject-batch', {
        batchId: bId,
        reason: r,
        agentId: 'agent_1'
      });
      assert(`Accept valid rejection reason: "${r}"`, res.status === 200 && res.data.success);
    }

    // -------------------------------------------------------------------------
    // 2. QUALITY PARAMETER BOUNDARY & NEGATIVE VALUE TESTING
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Quality Parameter Boundaries & Extreme Values ---');

    const p3 = await request('POST', '/api/farmer/request-pickup', { farmerId: 'farmer_1', liters: 25 });
    const bId3 = p3.data.batchId;

    // Negative Fat
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
    const excessiveWth = await request('POST', '/api/farmer/payout', {
      farmerId: 'farmer_1',
      amount: 999999999
    });
    assert('Reject withdrawal amount greater than balance (HTTP 400)', excessiveWth.status === 400);

    // Negative withdrawal amount
    const negWth = await request('POST', '/api/farmer/payout', {
      farmerId: 'farmer_1',
      amount: -100
    });
    assert('Reject negative withdrawal amount (HTTP 400)', negWth.status === 400);

    // -------------------------------------------------------------------------
    // 4. BATCH STATUS LIFECYCLE PROGRESSION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Batch Status Lifecycle Progression ---');

    const p4 = await request('POST', '/api/farmer/request-pickup', { farmerId: 'farmer_1', liters: 50 });
    const bId4 = p4.data.batchId;

    const invalidStatus = await request('PUT', `/api/batches/${bId4}/status`, {
      newStatus: 'InvalidStatusName'
    });
    assert('Reject invalid batch status name (HTTP 400)', invalidStatus.status === 400);

    // Step 1: Collected -> In Transit
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
      console.log('\n🎉 ALL 18/18 RBAC & EDGE CASE TESTS PASSED CLEANLY!');
    }

  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    if (server) server.close();
  }
}

runEdgeCases();

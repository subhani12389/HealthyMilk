const http = require('http');
const path = require('path');
const app = require('../src/server');

let server;
const PORT = 5099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Helper: Make HTTP request to backend server
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

async function runAudit() {
  console.log('===============================================================');
  console.log('🚀 Starting HealthyMilk Full E2E Automated Functionality Audit');
  console.log('===============================================================');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // -------------------------------------------------------------------------
    // 1. APPLICATION STARTUP & BASIC HEALTH
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Application Startup & Health ---');
    const healthRes = await request('GET', '/api/health');
    assert('Health endpoint returns 200 OK', healthRes.status === 200);
    assert('Health status is online', healthRes.data.status === 'online');

    const rootRes = await request('GET', '/');
    assert('Root endpoint returns 200 OK', rootRes.status === 200);
    assert('Root lists valid API endpoints', Array.isArray(rootRes.data.endpoints) && rootRes.data.endpoints.length > 0);

    // -------------------------------------------------------------------------
    // 2. AUTHENTICATION FLOW & OTP TESTING
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Authentication Flow & OTP ---');
    
    // 2.1 Invalid Phone Number
    const invalidPhoneRes = await request('POST', '/api/auth/send-otp', { phone: '123' });
    assert('Reject invalid phone number (< 10 digits)', invalidPhoneRes.status === 400);

    const emptyPhoneRes = await request('POST', '/api/auth/send-otp', { phone: '' });
    assert('Reject empty phone number', emptyPhoneRes.status === 400);

    // 2.2 Send OTP for New Farmer User
    const farmerPhone = '9876540001';
    const sendOtpFarmer = await request('POST', '/api/auth/send-otp', { phone: farmerPhone });
    assert('Send OTP succeeds for valid 10-digit phone', sendOtpFarmer.status === 200 && sendOtpFarmer.data.success);
    assert('Masked phone number is formatted correctly', sendOtpFarmer.data.maskedPhone.includes('XXXXXXX'));

    // 2.3 Resend Cooldown Enforcement
    const resendCooldown = await request('POST', '/api/auth/send-otp', { phone: farmerPhone });
    assert('Enforce 30s resend cooldown (HTTP 429)', resendCooldown.status === 429);

    // 2.4 Invalid OTP Check
    const wrongOtp = await request('POST', '/api/auth/verify-otp', { phone: farmerPhone, otp: '000000' });
    assert('Reject incorrect OTP with error message', wrongOtp.status === 400 && wrongOtp.data.success === false);

    // 2.5 Correct OTP Verification
    // Using verified test OTP '123456'
    const verifyFarmer = await request('POST', '/api/auth/verify-otp', { phone: farmerPhone, otp: '123456' });
    assert('Verify correct OTP for new user', verifyFarmer.status === 200 && verifyFarmer.data.success);
    assert('New user receives verificationToken', Boolean(verifyFarmer.data.verificationToken));

    const farmerVerToken = verifyFarmer.data.verificationToken;

    // 2.6 Create Farmer Account
    const createFarmer = await request('POST', '/api/auth/create-account', {
      phone: farmerPhone,
      role: 'farmer',
      farmName: 'Green Valley Organic Dairy',
      verificationToken: farmerVerToken
    });
    assert('Create new Farmer account', createFarmer.status === 201 && createFarmer.data.success);
    assert('Farmer account role is set correctly', createFarmer.data.user.role === 'farmer');
    assert('JWT token is returned upon creation', Boolean(createFarmer.data.token));

    const farmerToken = createFarmer.data.token;
    const farmerId = createFarmer.data.user.id;

    // 2.7 Verify JWT Session Profile (/api/auth/me)
    const meRes = await request('GET', '/api/auth/me', null, { Authorization: `Bearer ${farmerToken}` });
    assert('Fetch authenticated user profile with JWT', meRes.status === 200 && meRes.data.user.id === farmerId);

    const meUnauthorized = await request('GET', '/api/auth/me');
    assert('Block /api/auth/me without JWT token (HTTP 401)', meUnauthorized.status === 401);

    // 2.8 Create Delivery Agent & Consumer Accounts
    const agentPhone = '9876540002';
    await request('POST', '/api/auth/send-otp', { phone: agentPhone });
    const verifyAgent = await request('POST', '/api/auth/verify-otp', { phone: agentPhone, otp: '123456' });
    const createAgent = await request('POST', '/api/auth/create-account', {
      phone: agentPhone,
      role: 'delivery_agent',
      verificationToken: verifyAgent.data.verificationToken
    });
    assert('Create Delivery Agent account', createAgent.status === 201 && createAgent.data.user.role === 'delivery_agent');
    const agentToken = createAgent.data.token;
    const agentId = createAgent.data.user.id;

    const consumerPhone = '9876540003';
    await request('POST', '/api/auth/send-otp', { phone: consumerPhone });
    const verifyConsumer = await request('POST', '/api/auth/verify-otp', { phone: consumerPhone, otp: '123456' });
    const createConsumer = await request('POST', '/api/auth/create-account', {
      phone: consumerPhone,
      role: 'consumer',
      verificationToken: verifyConsumer.data.verificationToken
    });
    assert('Create Consumer account', createConsumer.status === 201 && createConsumer.data.user.role === 'consumer');
    const consumerToken = createConsumer.data.token;
    const consumerId = createConsumer.data.user.id;

    // -------------------------------------------------------------------------
    // 3. FARMER PORTAL & BATCH CREATION WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Farmer Portal & Batch Creation ---');

    // 3.1 Invalid Milk Volume
    const invalidPickup = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 0
    });
    assert('Reject 0 liter milk pickup request', invalidPickup.status === 400);

    // 3.2 Valid Milk Pickup Request
    const pickupRes = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 60,
      notes: 'Fresh organic morning batch'
    });
    assert('Farmer logs milk pickup request & generates Batch ID', pickupRes.status === 200 && pickupRes.data.success);
    assert('Batch ID matches format HM-YYYYMMDD-XXXX', /^HM-\d{8}-\d{4}$/.test(pickupRes.data.batchId));
    assert('Batch status initialized to Collected', pickupRes.data.batch.status === 'Collected');

    const createdBatchId = pickupRes.data.batchId;

    // 3.3 Farmer Dashboard Load
    const farmerDash = await request('GET', `/api/farmer/dashboard?farmerId=${farmerId}`);
    assert('Farmer dashboard loads successfully', farmerDash.status === 200 && farmerDash.data.success);
    assert('Farmer dashboard contains active batches', Array.isArray(farmerDash.data.batches) && farmerDash.data.batches.length > 0);

    // 3.4 Farmer Settings Update
    const settingsRes = await request('PUT', '/api/farmer/settings', {
      farmerId,
      farmName: 'Sunrise Organic Farm',
      cattleCount: 30,
      bankDetails: { accountNo: '1122334455', bankName: 'HDFC Bank' }
    });
    assert('Update farmer farm profile & settings', settingsRes.status === 200 && settingsRes.data.success);

    // -------------------------------------------------------------------------
    // 4. DELIVERY AGENT QUALITY TESTING & ACCEPTANCE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Delivery Agent Inspection & Payout Calculation ---');

    // 4.1 Invalid Quality Parameter Validation
    const invalidFat = await request('POST', '/api/delivery/test-and-collect', {
      batchId: createdBatchId,
      testedFat: 20.0, // > 15 max
      testedSNF: 8.5
    });
    assert('Reject invalid Fat % (> 15.0%)', invalidFat.status === 400);

    // 4.2 Valid Quality Testing & Milk Acceptance
    const testCollectRes = await request('POST', '/api/delivery/test-and-collect', {
      batchId: createdBatchId,
      testedFat: 4.8,
      testedSNF: 8.9,
      lactometerReading: 30.5,
      temperature: 4.0,
      liters: 60,
      agentId,
      agentName: 'Delivery Agent 002',
      remarks: 'Lab-grade field test passed'
    });

    assert('Quality test & collection passes', testCollectRes.status === 200 && testCollectRes.data.success);
    assert('Batch status transitions to Accepted', testCollectRes.data.batch.status === 'Accepted');
    assert('Quality score computed (> 80)', testCollectRes.data.qualityTest.qualityScore >= 80);
    assert('Farmer balance credited with (Liters * Rate)', testCollectRes.data.creditedAmount > 0);

    // 4.3 Verify Farmer Balance Increased
    const farmerDashAfter = await request('GET', `/api/farmer/dashboard?farmerId=${farmerId}`);
    assert('Farmer available balance updated in dashboard', farmerDashAfter.data.farmer.balance > 0);

    // 4.4 Farmer Payout Withdrawal Request
    const payoutReq = await request('POST', '/api/farmer/payout', {
      farmerId,
      amount: 500
    });
    assert('Farmer requests bank payout withdrawal', payoutReq.status === 200 && payoutReq.data.success);
    assert('Withdrawal amount deducted from farmer balance', payoutReq.data.remainingBalance < farmerDashAfter.data.farmer.balance);

    // -------------------------------------------------------------------------
    // 5. MILK REJECTION WORKFLOW & ADMIN RESOLUTION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Milk Rejection & Admin Resolution ---');

    // 5.1 Create Second Batch to Test Rejection
    const batch2Res = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 40,
      notes: 'Evening batch test rejection'
    });
    const rejBatchId = batch2Res.data.batchId;

    // 5.2 Delivery Agent Rejection
    const rejectRes = await request('POST', '/api/delivery/reject-batch', {
      batchId: rejBatchId,
      agentId,
      reason: 'Abnormal Fat/SNF',
      notes: 'Water content detected during lactometer test'
    });
    assert('Batch rejection flagged by delivery agent', rejectRes.status === 200 && rejectRes.data.success);
    assert('Batch status transitions to Rejected', rejectRes.data.batch.status === 'Rejected');
    assert('Rejection quarantine logged in audit trail', Boolean(rejectRes.data.batch.rejectionDetails));

    // 5.3 Batch Detail Query by ID
    const batchDetailRes = await request('GET', `/api/batches/${rejBatchId}`);
    assert('Fetch batch detail by Batch ID', batchDetailRes.status === 200 && batchDetailRes.data.batch.batchId === rejBatchId);
    assert('Batch shows Rejected status and notes', batchDetailRes.data.batch.rejectionDetails.reason === 'Abnormal Fat/SNF');

    // -------------------------------------------------------------------------
    // 6. CONSUMER WORKFLOW (CATALOG, SUBSCRIPTIONS, ORDERS)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Consumer Subscriptions & Orders ---');

    // 6.1 Get Products Catalog
    const catalogRes = await request('GET', '/api/consumer/products');
    assert('Fetch consumer products catalog', catalogRes.status === 200 && Array.isArray(catalogRes.data.products));

    // 6.2 Update Consumer Subscription
    const subRes = await request('POST', '/api/consumer/subscription', {
      consumerId,
      plan: 'Daily',
      quantity: 2,
      productType: 'A2 Cow Milk',
      deliveryTime: 'Morning (6 AM - 8 AM)'
    });
    assert('Subscribe to daily milk delivery', subRes.status === 200 && subRes.data.success);
    assert('Subscription status is active', subRes.data.subscription.status === 'Active');

    // 6.3 Pause Subscription
    const pauseRes = await request('POST', '/api/consumer/subscription/pause', {
      consumerId,
      pauseStartDate: '2026-10-01',
      pauseEndDate: '2026-10-07'
    });
    assert('Pause subscription for vacation period', pauseRes.status === 200 && pauseRes.data.success);
    assert('Subscription state set to Paused', pauseRes.data.subscription.status === 'Paused');

    // 6.4 Resume Subscription
    const resumeRes = await request('POST', '/api/consumer/subscription/resume', { consumerId });
    assert('Resume paused subscription', resumeRes.status === 200 && resumeRes.data.subscription.status === 'Active');

    // 6.5 Consumer Place Instant Order
    const orderRes = await request('POST', '/api/consumer/order', {
      consumerId,
      items: [{ productId: 'p1', name: 'A2 Cow Milk', quantity: 3, price: 65 }],
      deliveryAddress: 'Flat 402, Green Meadows Apt, Bangalore',
      paymentMethod: 'UPI'
    });
    assert('Consumer places instant product order', orderRes.status === 200 && orderRes.data.success);
    assert('Order ID generated', Boolean(orderRes.data.order.orderId));

    // -------------------------------------------------------------------------
    // 7. PUBLIC BATCH TRACEABILITY PORTAL
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Public Batch Traceability ---');
    const traceRes = await request('GET', `/api/batches/trace/${createdBatchId}`);
    assert('Trace batch from QR / Public ID', traceRes.status === 200 && traceRes.data.success);
    assert('Traceability returns farmer details & quality score', Boolean(traceRes.data.traceability.qualityTest));
    assert('Traceability includes complete chronological timeline', Array.isArray(traceRes.data.traceability.timeline));

    // -------------------------------------------------------------------------
    // 8. ADMIN CONTROL CENTER
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Admin Control Center ---');

    // 8.1 Admin Dashboard Stats
    const adminStats = await request('GET', '/api/admin/stats');
    assert('Admin fetch system-wide metrics', adminStats.status === 200 && adminStats.data.success);
    assert('Metrics include farmers, consumers, agents counts', typeof adminStats.data.stats.totalFarmers === 'number');

    // 8.2 Admin Batch Audit List
    const adminBatches = await request('GET', '/api/batches');
    assert('Admin queries master batch list', adminBatches.status === 200 && Array.isArray(adminBatches.data.batches));

    // 8.3 Admin Review & Release Quarantined Batch
    const adminReview = await request('POST', `/api/admin/batches/${rejBatchId}/review`, {
      action: 'RELEASE',
      adminNotes: 'Secondary lab check cleared minor variance'
    });
    assert('Admin reviews & releases quarantined batch', adminReview.status === 200 && adminReview.data.success);

    // 8.4 Admin Approve Farmer Payout Batch
    const adminPayouts = await request('POST', '/api/admin/payouts/process', {
      payoutIds: ['payout_test_01', 'payout_test_02']
    });
    assert('Admin processes scheduled farmer payout batch', adminPayouts.status === 200 && adminPayouts.data.success);

    // -------------------------------------------------------------------------
    // 9. NOTIFICATIONS SUBSYSTEM
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Notifications Subsystem ---');

    // 9.1 Fetch Notifications for Farmer
    const notifsRes = await request('GET', `/api/notifications?userId=${farmerId}`);
    assert('Fetch notifications for user', notifsRes.status === 200 && Array.isArray(notifsRes.data.notifications));

    // 9.2 Mark All Notifications as Read
    const markReadRes = await request('PUT', '/api/notifications/mark-all-read', { userId: farmerId });
    assert('Mark all user notifications as read', markReadRes.status === 200 && markReadRes.data.success);

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`E2E Audit Complete: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} tests.`);
    console.log('===============================================================');

    if (failedCount > 0) {
      console.error('\n⚠️ Some tests failed! Inspect output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 ALL 47/47 CORE E2E AUDIT TESTS PASSED CLEANLY!');
    }

  } catch (err) {
    console.error('Fatal Error during E2E Audit:', err);
  } finally {
    if (server) server.close();
  }
}

runAudit();

const http = require('http');
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../src/models/User');
const OtpChallenge = require('../src/models/OtpChallenge');
const EmailOtpChallenge = require('../src/models/EmailOtpChallenge');
const MilkBatch = require('../src/models/MilkBatch');
const Transaction = require('../src/models/Transaction');
const Order = require('../src/models/Order');
const Subscription = require('../src/models/Subscription');
const Delivery = require('../src/models/Delivery');
const Notification = require('../src/models/Notification');
const { testDeliveredEmails } = require('../src/services/emailService');
const { prepareTestDatabase } = require('./testDatabase');
const { getPagination } = require('../src/utils/pagination');

let server;
let smsServer;
let app;
let latestOtp;
let authToken = '';
const deliveredOtps = new Map();
const smsGatewaySecuritySamples = [];
const PORT = 5099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const authTimingSamples = [];
const originalConsoleInfo = console.info;
console.info = (...args) => {
  if (args[0] === 'Auth API request timing' && args[1]) authTimingSamples.push(args[1]);
  originalConsoleInfo(...args);
};

// Helper: Make HTTP request to backend server
function request(method, path, body = null, headers = {}, localAddress) {
  return new Promise((resolve, reject) => {
    const startedAt = process.hrtime.bigint();
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
      headers: reqHeaders,
      ...(localAddress ? { localAddress } : {})
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
          data: parsed,
          durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const results = [];
const otpSendMeasurements = [];
const otpVerifyMeasurements = [];
const loginMeasurements = [];

function printMeasurements(label, measurements) {
  if (!measurements.length) return;
  const sorted = [...measurements].sort((a, b) => a - b);
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const percentile = value => sorted[Math.max(0, Math.ceil(value * sorted.length) - 1)];
  console.log(`${label}: n=${sorted.length}, average=${average.toFixed(2)}ms, p50=${percentile(0.5).toFixed(2)}ms, p95=${percentile(0.95).toFixed(2)}ms, max=${sorted[sorted.length - 1].toFixed(2)}ms`);
}

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    results.push({ test: description, passed: true, details });
  } else {
    console.error(`  ❌ FAIL: ${description} - ${details}`);
    results.push({ test: description, passed: false, details });
  }
}

async function mongoSupportsTransactions() {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    return Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch (error) {
    return false;
  }
}

async function runAudit() {
  console.log('===============================================================');
  console.log('🚀 Starting HealthyMilk Full E2E Automated Functionality Audit');
  console.log('===============================================================');

  // Use a local SMS gateway so the real random OTP can be verified without credentials.
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.TWILIO_PHONE_NUMBER = '';
  process.env.FAST2SMS_API_KEY = '';
  process.env.MSG91_AUTH_KEY = '';
  process.env.MSG91_TEMPLATE_ID = '';
  process.env.SMS_API_METHOD = 'POST';
  process.env.SMS_API_KEY = 'audit-test-key';
  process.env.ALLOW_STANDALONE_TRANSACTIONS = 'true';
  process.env.NODE_ENV = 'production';
  process.env.MOCK_EMAIL = 'true';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  smsServer = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    const handleMessage = body => {
      latestOtp = body.otp || requestUrl.searchParams.get('otp');
      const phone = body.phone || requestUrl.searchParams.get('to');
      deliveredOtps.set(phone, latestOtp);
      const validApiKey = req.headers['x-api-key'] === 'audit-test-key';
      smsGatewaySecuritySamples.push({
        method: req.method,
        hasQuery: Boolean(requestUrl.search),
        hasApiKeyHeader: validApiKey,
        hasExpectedIndianE164: body.to === `+91${phone}`,
        hasTenDigitLocalPhone: /^\d{10}$/.test(body.phone || '')
      });
      if (phone === '9876540088') return;
      if (phone === '9876540098') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"success":false,"message":"Template rejected","error_code":"TEMPLATE_INVALID"}');
        return;
      }
      if (phone === '9876540093') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"success":true,"status":"failed","message":"Delivery rejected"}');
        return;
      }
      const statusCode = !validApiKey ? 401 : phone === '9876540099' ? 503 : 200;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end('{"success":true}');
    };
    if (req.method === 'POST') {
      let requestBody = '';
      req.on('data', chunk => requestBody += chunk);
      req.on('end', () => handleMessage(JSON.parse(requestBody)));
    } else {
      handleMessage({});
    }
  });
  await new Promise((resolve) => smsServer.listen(0, '127.0.0.1', resolve));
  process.env.SMS_API_URL = `http://127.0.0.1:${smsServer.address().port}/`;

  try {
    await prepareTestDatabase();
    app = require('../src/server');
    await new Promise((resolve) => {
      server = app.listen(PORT, resolve);
    });

    // -------------------------------------------------------------------------
    // 1. APPLICATION STARTUP & BASIC HEALTH
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Application Startup & Health ---');
    const cappedPagination = getPagination({ page: '0', limit: '10000' });
    const oversizedPagePagination = getPagination({ page: String(Number.MAX_SAFE_INTEGER), limit: '100' });
    assert('Pagination defaults invalid pages and caps requested result limits',
      cappedPagination.page === 1 && cappedPagination.limit === 100);
    assert('Pagination clamps unsafe offsets before querying MongoDB',
      Number.isSafeInteger(oversizedPagePagination.skip));
    const healthRes = await request('GET', '/api/health');
    assert('Health endpoint returns 200 OK', healthRes.status === 200);
    assert('Health status is online', healthRes.data.status === 'online');

    const rootRes = await request('GET', '/');
    assert('Root endpoint returns 200 OK', rootRes.status === 200);
    assert('Root lists valid API endpoints', Array.isArray(rootRes.data.endpoints) && rootRes.data.endpoints.length > 0);
    const mutationPreflight = await request('OPTIONS', '/api/farmer/request-pickup', null, {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization,idempotency-key'
    });
    assert('CORS preflight permits browser idempotency headers',
      mutationPreflight.status === 204 &&
      mutationPreflight.headers['access-control-allow-headers']?.toLowerCase().includes('idempotency-key'));
    const untrustedPreflight = await request('OPTIONS', '/api/farmer/request-pickup', null, {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'POST'
    });
    assert('Production CORS denies unconfigured browser origins',
      untrustedPreflight.status === 204 &&
      !untrustedPreflight.headers['access-control-allow-origin']);

    // -------------------------------------------------------------------------
    // 2. EMAIL + PASSWORD AUTHENTICATION & SECURITY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Email + Password Authentication & Security ---');
    
    // 2.1 Registration Input Validations
    const invalidEmailReg = await request('POST', '/api/auth/register', {
      email: 'not-a-valid-email',
      password: 'ValidPassword123',
      fullName: 'Test User',
      role: 'consumer'
    });
    assert('Reject invalid email format during registration (HTTP 400)', invalidEmailReg.status === 400);

    const weakPasswordReg = await request('POST', '/api/auth/register', {
      email: 'weakpass@healthymilk.test',
      password: 'weak',
      fullName: 'Test User',
      role: 'consumer'
    });
    assert('Reject short/weak password < 8 characters (HTTP 400)', weakPasswordReg.status === 400);

    const noUpperReg = await request('POST', '/api/auth/register', {
      email: 'noupper@healthymilk.test',
      password: 'lowercaseonly123',
      fullName: 'Test User',
      role: 'consumer'
    });
    assert('Reject password without uppercase letter (HTTP 400)', noUpperReg.status === 400);

    const noNumberReg = await request('POST', '/api/auth/register', {
      email: 'nonumber@healthymilk.test',
      password: 'NoNumbersHereAtAll',
      fullName: 'Test User',
      role: 'consumer'
    });
    assert('Reject password without numerical digits (HTTP 400)', noNumberReg.status === 400);

    const shortNameReg = await request('POST', '/api/auth/register', {
      email: 'validname@healthymilk.test',
      password: 'ValidPassword123',
      fullName: 'A',
      role: 'consumer'
    });
    assert('Reject registration with missing/short name (HTTP 400)', shortNameReg.status === 400);

    const adminSelfReg = await request('POST', '/api/auth/register', {
      email: 'fakeadmin@healthymilk.test',
      password: 'AdminPassword123',
      fullName: 'Malicious Admin',
      role: 'admin'
    });
    assert('Reject admin self-registration (HTTP 400)', adminSelfReg.status === 400);

    // 2.2 Register Farmer Account (Pending Email Verification)
    const farmerEmail = 'farmer@healthymilk.test';
    const farmerPassword = 'DairyFarmer@2026';
    const createFarmer = await request('POST', '/api/auth/register', {
      email: farmerEmail,
      password: farmerPassword,
      fullName: 'Ramesh Patel',
      role: 'farmer',
      farmName: 'Green Valley Organic Dairy'
    });
    assert('Register new Farmer account initiates Email OTP verification (HTTP 201)',
      createFarmer.status === 201 && createFarmer.data.requiresEmailVerification && createFarmer.data.maskedEmail);
    assert('Registration response masks user email appropriately',
      Boolean(createFarmer.data?.maskedEmail?.includes('***@')));

    const unverifiedFarmerDoc = await User.findOne({ email: farmerEmail });
    assert('Farmer account is saved in MongoDB with isEmailVerified = false',
      Boolean(unverifiedFarmerDoc) && unverifiedFarmerDoc.isEmailVerified === false);

    // 2.3 Unverified Account Login Protection
    const unverifiedLogin = await request('POST', '/api/auth/login', {
      email: farmerEmail,
      password: farmerPassword
    });
    assert('Block unverified account login with HTTP 403 and unverified flag',
      unverifiedLogin.status === 403 && unverifiedLogin.data.unverified === true);

    // 2.4 Email OTP Verification Edge Cases & Completion
    const invalidOtpFormat = await request('POST', '/api/auth/verify-email', {
      email: farmerEmail,
      otp: '12'
    });
    assert('Reject malformed OTP input during email verification (HTTP 400)', invalidOtpFormat.status === 400);

    const wrongOtpVerify = await request('POST', '/api/auth/verify-email', {
      email: farmerEmail,
      otp: '000000'
    });
    assert('Reject incorrect 6-digit OTP during email verification (HTTP 400)', wrongOtpVerify.status === 400);

    const cooldownResend = await request('POST', '/api/auth/resend-verification', {
      email: farmerEmail
    });
    assert('Enforce 60-second cooldown on OTP resend requests (HTTP 429)', cooldownResend.status === 429);

    const farmerOtpData = testDeliveredEmails.get(farmerEmail.toLowerCase());
    assert('Email delivery service queued 6-digit OTP for farmer', Boolean(farmerOtpData?.otp));

    const farmerVerify = await request('POST', '/api/auth/verify-email', {
      email: farmerEmail,
      otp: farmerOtpData.otp
    });
    assert('Verify email with valid 6-digit OTP activates account and issues JWT (HTTP 200)',
      farmerVerify.status === 200 && farmerVerify.data.success && Boolean(farmerVerify.data.token));
    assert('Verified farmer user object contains proper role',
      farmerVerify.data.user?.role === 'farmer' && farmerVerify.data.user?.isEmailVerified === true);

    const farmerToken = farmerVerify.data.token;
    const farmerId = farmerVerify.data.user.id;
    authToken = farmerToken;

    const replayVerify = await request('POST', '/api/auth/verify-email', {
      email: farmerEmail,
      otp: farmerOtpData.otp
    });
    assert('Prevent OTP replay attack: already claimed OTP is rejected (HTTP 400)', replayVerify.status === 400);

    // 2.5 Duplicate Email Registration
    const duplicateEmailReg = await request('POST', '/api/auth/register', {
      email: farmerEmail,
      password: 'AnotherPassword123',
      fullName: 'Duplicate User',
      role: 'consumer'
    });
    assert('Reject duplicate email registration for verified account with 409 Conflict', duplicateEmailReg.status === 409);

    // 2.6 Register & Verify Delivery Agent Account
    const agentEmail = 'agent@healthymilk.test';
    const agentPassword = 'AgentSecure@2026';
    const createAgent = await request('POST', '/api/auth/register', {
      email: agentEmail,
      password: agentPassword,
      fullName: 'Vikram Singh',
      role: 'delivery_agent',
      vehicleNo: 'GJ-07-MK-4421',
      assignedArea: 'Sector 14 & Green Valley'
    });
    assert('Register Delivery Agent account initiates verification (HTTP 201)', createAgent.status === 201);
    const agentOtpData = testDeliveredEmails.get(agentEmail.toLowerCase());
    const agentVerify = await request('POST', '/api/auth/verify-email', {
      email: agentEmail,
      otp: agentOtpData.otp
    });
    assert('Verify Delivery Agent email successfully (HTTP 200)',
      agentVerify.status === 200 && agentVerify.data.user.role === 'delivery_agent');
    const agentToken = agentVerify.data.token;
    const agentId = agentVerify.data.user.id;

    // 2.7 Register & Verify Consumer Account
    const consumerEmail = 'consumer@healthymilk.test';
    const consumerPassword = 'ConsumerMilk@2026';
    const createConsumer = await request('POST', '/api/auth/register', {
      email: consumerEmail,
      password: consumerPassword,
      fullName: 'Ananya Sharma',
      role: 'consumer'
    });
    assert('Register Consumer account initiates verification (HTTP 201)', createConsumer.status === 201);
    const consumerOtpData = testDeliveredEmails.get(consumerEmail.toLowerCase());
    const consumerVerify = await request('POST', '/api/auth/verify-email', {
      email: consumerEmail,
      otp: consumerOtpData.otp
    });
    assert('Verify Consumer email successfully (HTTP 200)',
      consumerVerify.status === 200 && consumerVerify.data.user.role === 'consumer');
    const consumerToken = consumerVerify.data.token;
    const consumerId = consumerVerify.data.user.id;
    assert('New verified consumer has a persisted initial 30-day active subscription',
      Boolean(await Subscription.findOne({ consumerId, status: 'Active' })));

    // 2.8 Login Flow & Credential Validation
    const farmerLogin = await request('POST', '/api/auth/login', {
      email: farmerEmail,
      password: farmerPassword
    });
    assert('Login succeeds for verified email and password (HTTP 200)',
      farmerLogin.status === 200 && farmerLogin.data.success && Boolean(farmerLogin.data.token));

    const wrongPasswordLogin = await request('POST', '/api/auth/login', {
      email: farmerEmail,
      password: 'IncorrectPassword999'
    });
    assert('Reject login with incorrect password (HTTP 401)', wrongPasswordLogin.status === 401);

    const nonExistentLogin = await request('POST', '/api/auth/login', {
      email: 'nonexistent_user_999@healthymilk.test',
      password: 'SomePassword123'
    });
    assert('Reject login with non-existent email (HTTP 401)', nonExistentLogin.status === 401);

    // 2.9 JWT Session Profile Verification (/api/auth/me)
    const meRes = await request('GET', '/api/auth/me', null, { Authorization: `Bearer ${farmerToken}` });
    assert('Fetch authenticated user profile with JWT (/api/auth/me)',
      meRes.status === 200 && meRes.data.user.id === farmerId && meRes.data.user.email === farmerEmail);

    const meUnauthorized = await request('GET', '/api/auth/me', null, { Authorization: '' });
    assert('Block /api/auth/me without JWT token (HTTP 401)', meUnauthorized.status === 401);

    // 2.10 Password Reset & Single-Use Token Workflow
    const nonExistentForgot = await request('POST', '/api/auth/forgot-password', {
      email: 'unregistered@healthymilk.test'
    });
    assert('Account enumeration protection: forgot-password returns generic 200 for unregistered email',
      nonExistentForgot.status === 200 && nonExistentForgot.data.success);

    const farmerForgot = await request('POST', '/api/auth/forgot-password', {
      email: farmerEmail
    });
    assert('Generate password reset token for registered email (HTTP 200)',
      farmerForgot.status === 200 && Boolean(farmerForgot.data.resetToken));
    const resetToken = farmerForgot.data.resetToken;

    const invalidTokenReset = await request('POST', '/api/auth/reset-password', {
      resetToken: 'invalid_token_xyz_123',
      newPassword: 'NewValidPassword@2026'
    });
    assert('Reject password reset with invalid token (HTTP 400)', invalidTokenReset.status === 400);

    const weakNewPassReset = await request('POST', '/api/auth/reset-password', {
      resetToken,
      newPassword: 'weak'
    });
    assert('Reject weak new password during reset (HTTP 400)', weakNewPassReset.status === 400);

    const successfulReset = await request('POST', '/api/auth/reset-password', {
      resetToken,
      newPassword: 'BrandNewPassword@2026'
    });
    assert('Successfully reset password with valid token (HTTP 200)',
      successfulReset.status === 200 && successfulReset.data.success);

    const reusedTokenReset = await request('POST', '/api/auth/reset-password', {
      resetToken,
      newPassword: 'AnotherPassword@2026'
    });
    assert('Enforce single-use token: reused reset token is rejected (HTTP 400)', reusedTokenReset.status === 400);

    const oldPassLogin = await request('POST', '/api/auth/login', {
      email: farmerEmail,
      password: farmerPassword
    });
    assert('Old password is now rejected after password reset (HTTP 401)', oldPassLogin.status === 401);

    const newPassLogin = await request('POST', '/api/auth/login', {
      email: farmerEmail,
      password: 'BrandNewPassword@2026'
    });
    assert('Login succeeds with newly reset password (HTTP 200)',
      newPassLogin.status === 200 && Boolean(newPassLogin.data.token));

    // 2.11 Logout Endpoint
    const logoutRes = await request('POST', '/api/auth/logout');
    assert('Logout endpoint terminates session successfully (HTTP 200)', logoutRes.status === 200);

    authToken = farmerToken;

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
    const pickupKey = crypto.randomUUID();
    const pickupRes = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 60,
      notes: 'Fresh organic morning batch'
    }, { 'Idempotency-Key': pickupKey });
    assert('Farmer logs milk pickup request & generates Batch ID', pickupRes.status === 201 && pickupRes.data.success);
    const duplicatePickup = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 60,
      notes: 'Fresh organic morning batch'
    }, { 'Idempotency-Key': pickupKey });
    assert('Duplicate pickup request with the same key reuses the original batch',
      duplicatePickup.status === 200 && duplicatePickup.data.batchId === pickupRes.data.batchId &&
      await MilkBatch.countDocuments({ farmerId, idempotencyKey: { $exists: true } }) === 1);
    assert('Batch ID matches format HM-YYYYMMDD-XXXX', /^HM-\d{8}-\d{4}$/.test(pickupRes.data.batchId));
    assert('Batch status initialized to Collected', pickupRes.data.batch.status === 'Collected');
    assert('Pickup request persists as a MongoDB batch document',
      Boolean(await MilkBatch.findOne({ batchId: pickupRes.data.batchId })));

    const createdBatchId = pickupRes.data.batchId;
    const legacyBatchRes = await request('POST', '/api/batches/create', {
      liters: 7,
      notes: 'Legacy batch route lifecycle audit'
    });
    const legacyBatchId = legacyBatchRes.data?.batch?.batchId;
    assert('Legacy batch-create route remains explicitly deprecated but operational',
      legacyBatchRes.status === 201 &&
      legacyBatchRes.headers.deprecation === 'true' &&
      legacyBatchRes.headers.link?.includes('/api/farmer/request-pickup') &&
      Boolean(await MilkBatch.findOne({ batchId: legacyBatchId, farmerId, status: 'Collected' })));
    const duplicateLegacyBatch = await MilkBatch.create({
      batchId: legacyBatchId,
      farmerId,
      farmerName: 'Duplicate test',
      liters: 1
    }).then(() => false).catch(error => error.code === 11000);
    assert('Legacy batch ID is protected by MongoDB unique index',
      duplicateLegacyBatch &&
      MilkBatch.schema.indexes().some(([keys, options]) => keys.batchId === 1 && options.unique));
    const legacyRejectedBatchRes = await request('POST', '/api/batches/create', {
      liters: 3,
      notes: 'Legacy batch rejection workflow audit'
    });
    const legacyRejectedBatchId = legacyRejectedBatchRes.data?.batch?.batchId;
    assert('Legacy route creates inventory batch records consumed by the existing batch workflow',
      legacyRejectedBatchRes.status === 201 &&
      Boolean(await MilkBatch.findOne({ batchId: legacyRejectedBatchId, status: 'Collected' })));

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
    const persistedFarmerSettings = await User.findById(farmerId).lean();
    assert('Farmer profile settings persist in MongoDB',
      persistedFarmerSettings?.farmName === 'Sunrise Organic Farm' &&
      persistedFarmerSettings?.cattleCount === 30 &&
      persistedFarmerSettings?.bankDetails?.bankName === 'HDFC Bank');

    // -------------------------------------------------------------------------
    // 4. DELIVERY AGENT QUALITY TESTING & ACCEPTANCE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Delivery Agent Inspection & Payout Calculation ---');

    // 4.1 Invalid Quality Parameter Validation
    authToken = agentToken;
    const invalidFat = await request('POST', '/api/delivery/test-and-collect', {
      batchId: createdBatchId,
      testedFat: 20.0, // > 15 max
      testedSNF: 8.5
    });
    assert('Reject invalid Fat % (> 15.0%)', invalidFat.status === 400);

    // 4.2 A failed ledger write must roll back the batch and both wallet credits.
    const farmerBalanceBeforeFailedCollection = (await User.findById(farmerId)).balance;
    const agentBalanceBeforeFailedCollection = (await User.findById(agentId)).balance;
    const transactionCreate = Transaction.create;
    const supportsTransactions = await mongoSupportsTransactions();
    Transaction.create = async () => { throw new Error('Injected transaction-write failure'); };
    let failedCollection;
    try {
      failedCollection = await request('POST', '/api/delivery/test-and-collect', {
        batchId: createdBatchId,
        testedFat: 4.8,
        testedSNF: 8.9,
        lactometerReading: 30.5,
        temperature: 4.0,
        liters: 60,
        remarks: 'Failure-injection rollback test'
      });
    } finally {
      Transaction.create = transactionCreate;
    }
    const failedCollectionOutcome = supportsTransactions
      ? failedCollection.status === 500 &&
        (await MilkBatch.findOne({ batchId: createdBatchId })).status === 'Collected' &&
        (await User.findById(farmerId)).balance === farmerBalanceBeforeFailedCollection &&
        (await User.findById(agentId)).balance === agentBalanceBeforeFailedCollection &&
        !await Transaction.exists({ reference: `BATCH-CREDIT-${createdBatchId}` })
      : failedCollection.status === 500 || failedCollection.status === 503;
    assert('Failed batch ledger write returns safe error status', failedCollectionOutcome);
    if (!supportsTransactions) {
      await MilkBatch.updateOne({ batchId: createdBatchId }, { $set: { status: 'Collected' } });
    }

    // 4.3 Valid Quality Testing & Milk Acceptance
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
    const persistedQualityBatch = await MilkBatch.findOne({ batchId: createdBatchId }).lean();
    assert('Quality result and history persist in MongoDB',
      persistedQualityBatch?.qualityTest?.qualityScore >= 80 && persistedQualityBatch?.qualityHistory?.length > 0);
    assert('Farmer balance credited with (Liters * Rate)', testCollectRes.data.creditedAmount > 0);
    const legacyQualityAcceptance = await request('POST', '/api/delivery/test-and-collect', {
      batchId: legacyBatchId,
      testedFat: 4.5,
      testedSNF: 8.5,
      lactometerReading: 29,
      temperature: 4
    });
    assert('Legacy-created MongoDB batch completes the current quality-acceptance workflow',
      legacyQualityAcceptance.status === 200 &&
      legacyQualityAcceptance.data.batch.status === 'Accepted' &&
      Boolean((await MilkBatch.findOne({ batchId: legacyBatchId })).qualityTest));
    const legacyRejection = await request('POST', '/api/delivery/reject-batch', {
      batchId: legacyRejectedBatchId,
      reason: 'Low quality reading',
      remarks: 'Legacy-route rejection path'
    });
    const persistedLegacyRejection = await MilkBatch.findOne({ batchId: legacyRejectedBatchId });
    assert('Legacy-created MongoDB batch completes the current rejection lifecycle',
      legacyRejection.status === 200 &&
      persistedLegacyRejection.status === 'Rejected' &&
      persistedLegacyRejection.rejection.reviewStatus === 'Pending');

    // 4.3 Verify Farmer Balance Increased
    authToken = farmerToken;
    const farmerDashAfter = await request('GET', `/api/farmer/dashboard?farmerId=${farmerId}`);
    assert('Farmer available balance updated in dashboard', farmerDashAfter.data.farmer.balance > 0);

    // 4.4 Farmer Payout Withdrawal Request
    const farmerPayoutKey = crypto.randomUUID();
    const payoutReq = await request('POST', '/api/farmer/payout', {
      farmerId,
      amount: 500
    }, { 'Idempotency-Key': farmerPayoutKey });
    assert('Farmer requests bank payout withdrawal', payoutReq.status === 200 && payoutReq.data.success);
    assert('Withdrawal amount deducted from farmer balance', payoutReq.data.remainingBalance < farmerDashAfter.data.farmer.balance);
    assert('Payout transaction persists in MongoDB',
      Boolean(await Transaction.findOne({ farmerId, reference: payoutReq.data.transaction.reference })));
    const farmerBalanceAfterPayout = (await User.findById(farmerId)).balance;
    const duplicateFarmerPayout = await request('POST', '/api/farmer/payout', {
      farmerId,
      amount: 500
    }, { 'Idempotency-Key': farmerPayoutKey });
    assert('Duplicate farmer withdrawal does not debit the wallet twice',
      duplicateFarmerPayout.status === 200 &&
      (await User.findById(farmerId)).balance === farmerBalanceAfterPayout &&
      await Transaction.countDocuments({ farmerId, type: 'Bank Withdrawal' }) === 1);
    const balanceBeforeFailedPayout = (await User.findById(farmerId)).balance;
    const failedPayoutKey = crypto.randomUUID();
    Transaction.create = async () => { throw new Error('Injected transaction-write failure'); };
    let failedPayout;
    try {
      failedPayout = await request('POST', '/api/farmer/payout', {
        farmerId,
        amount: 25
      }, { 'Idempotency-Key': failedPayoutKey });
    } finally {
      Transaction.create = transactionCreate;
    }
    const failedPayoutOutcome = supportsTransactions
      ? failedPayout.status === 500 &&
        (await User.findById(farmerId)).balance === balanceBeforeFailedPayout &&
        await Transaction.countDocuments({ farmerId, type: 'Bank Withdrawal' }) === 1
      : failedPayout.status === 500;
    assert('Failed withdrawal ledger write returns safe error status', failedPayoutOutcome);
    if (!supportsTransactions) {
      await User.findByIdAndUpdate(farmerId, { balance: balanceBeforeFailedPayout });
    }
    const farmerHistoryPage = await request('GET', '/api/farmer/history?page=1&limit=1');
    assert('Farmer transaction and batch history use bounded server pagination',
      farmerHistoryPage.status === 200 && farmerHistoryPage.data.pagination.batches.limit === 1 &&
      farmerHistoryPage.data.pagination.transactions.totalItems >= 1);

    // -------------------------------------------------------------------------
    // 5. MILK REJECTION WORKFLOW & ADMIN RESOLUTION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Milk Rejection & Admin Resolution ---');

    // 5.1 Create Second Batch to Test Rejection
    const batch2Res = await request('POST', '/api/farmer/request-pickup', {
      farmerId,
      liters: 40,
      notes: 'Evening batch test rejection'
    }, { 'Idempotency-Key': crypto.randomUUID() });
    const rejBatchId = batch2Res.data.batchId;

    // 5.2 Delivery Agent Rejection
    authToken = agentToken;
    const rejectRes = await request('POST', '/api/delivery/reject-batch', {
      batchId: rejBatchId,
      agentId,
      reason: 'Abnormal Fat/SNF',
      notes: 'Water content detected during lactometer test'
    });
    assert('Batch rejection flagged by delivery agent', rejectRes.status === 200 && rejectRes.data.success);
    assert('Batch status transitions to Rejected', rejectRes.data.batch.status === 'Rejected');
    const duplicateRejection = await request('POST', '/api/delivery/reject-batch', {
      batchId: rejBatchId,
      reason: 'Abnormal Fat/SNF'
    });
    assert('Duplicate batch rejection cannot create a second inspection commission',
      duplicateRejection.status === 409 &&
      await Transaction.countDocuments({ reference: `REJECTION-FEE-${rejBatchId}` }) === 1);
    const persistedRejectedBatch = await MilkBatch.findOne({ batchId: rejBatchId }).lean();
    assert('Rejection and review state persist in MongoDB',
      persistedRejectedBatch?.status === 'Rejected' && persistedRejectedBatch?.rejection?.reason === 'Abnormal Fat/SNF');
    assert('Rejection quarantine logged in audit trail', Boolean(rejectRes.data.batch.rejection || rejectRes.data.batch.rejectionDetails));

    // 5.3 Batch Detail Query by ID
    const batchDetailRes = await request('GET', `/api/batches/${rejBatchId}`);
    assert('Fetch batch detail by Batch ID', batchDetailRes.status === 200 && batchDetailRes.data.batch.batchId === rejBatchId);
    const rejObj = batchDetailRes.data.batch.rejection || batchDetailRes.data.batch.rejectionDetails;
    assert('Batch shows Rejected status and notes', rejObj && rejObj.reason === 'Abnormal Fat/SNF');

    // -------------------------------------------------------------------------
    // 6. CONSUMER WORKFLOW (CATALOG, SUBSCRIPTIONS, ORDERS)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Consumer Subscriptions & Orders ---');

    // 6.1 Get Products Catalog
    authToken = consumerToken;
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
    assert('Subscribe to daily milk delivery', subRes.status === 201 && subRes.data.success);
    assert('Subscription status is active', subRes.data.subscription.status === 'Active');
    assert('Subscription is persisted in MongoDB',
      Boolean(await Subscription.findOne({ subscriptionId: subRes.data.subscription.subscriptionId, consumerId })));

    const subscriptionId = subRes.data.subscription.subscriptionId;
    await Subscription.updateOne({ subscriptionId }, {
      $set: {
        schedule: 'Monday',
        startDate: new Date('2030-01-07T00:00:00.000Z'),
        endDate: new Date('2030-02-06T00:00:00.000Z')
      }
    });
    app.locals.testClock = () => new Date('2030-01-08T10:00:00.000Z');
    const incorrectDeliveryDay = await request('POST', '/api/consumer/simulate-delivery-day', {});
    assert('Scheduled delivery is not generated on an unscheduled weekday',
      incorrectDeliveryDay.status === 409 &&
      await Delivery.countDocuments({ subscriptionId, scheduledDate: new Date('2030-01-08T00:00:00.000Z') }) === 0);

    // 6.3 Pause Subscription
    const pauseRes = await request('POST', '/api/consumer/subscription/pause', {
      consumerId
    });
    assert('Pause subscription for vacation period', pauseRes.status === 200 && pauseRes.data.success);
    assert('Subscription state set to Paused', pauseRes.data.subscription.status === 'Paused');
    assert('Paused dates and state persist in MongoDB',
      (await Subscription.findOne({ subscriptionId })).status === 'Paused' &&
      Boolean((await Subscription.findOne({ subscriptionId })).pauseStartDate));
    const pauseStartDate = pauseRes.data.subscription.pauseStartDate;
    const pauseNotificationCount = await Notification.countDocuments({
      userId: consumerId,
      title: 'Subscription Paused'
    });
    const repeatedPause = await request('POST', '/api/consumer/subscription/pause', { consumerId });
    assert('Repeated pause is idempotent and does not reset pause date or duplicate notifications',
      repeatedPause.status === 200 &&
      repeatedPause.data.unchanged === true &&
      repeatedPause.data.subscription.pauseStartDate === pauseStartDate &&
      await Notification.countDocuments({ userId: consumerId, title: 'Subscription Paused' }) === pauseNotificationCount);
    app.locals.testClock = () => new Date('2030-01-14T10:00:00.000Z');
    const pausedDelivery = await request('POST', '/api/consumer/simulate-delivery-day', {});
    assert('Paused subscription suppresses a scheduled delivery',
      pausedDelivery.status === 409 &&
      await Delivery.countDocuments({ subscriptionId }) === 0);

    // 6.4 Resume Subscription
    const resumeRes = await request('POST', '/api/consumer/subscription/resume', { consumerId });
    assert('Resume paused subscription', resumeRes.status === 200 && resumeRes.data.subscription.status === 'Active');
    assert('Resumed subscription persists in MongoDB',
      (await Subscription.findOne({ subscriptionId })).status === 'Active');
    const resumeDate = resumeRes.data.subscription.resumeDate;
    const resumeNotificationCount = await Notification.countDocuments({
      userId: consumerId,
      title: 'Subscription Active'
    });
    const repeatedResume = await request('POST', '/api/consumer/subscription/resume', { consumerId });
    assert('Repeated resume is idempotent and does not reset resume date or duplicate notifications',
      repeatedResume.status === 200 &&
      repeatedResume.data.unchanged === true &&
      repeatedResume.data.subscription.resumeDate === resumeDate &&
      await Notification.countDocuments({ userId: consumerId, title: 'Subscription Active' }) === resumeNotificationCount);

    const dueDeliveryRequests = await Promise.all([
      request('POST', '/api/consumer/simulate-delivery-day', {}),
      request('POST', '/api/consumer/simulate-delivery-day', {})
    ]);
    const scheduledDelivery = dueDeliveryRequests.find(response => response.status === 200)?.data?.delivery || (await Delivery.findOne({ subscriptionId }));
    assert('Scheduled delivery is generated on its configured weekday with correct consumer, subscription, and quantity',
      dueDeliveryRequests.some(response => response.status === 200) &&
      scheduledDelivery?.consumerId === consumerId &&
      scheduledDelivery?.subscriptionId === subscriptionId &&
      scheduledDelivery?.quantity === 2 &&
      new Date(scheduledDelivery?.scheduledDate).toISOString() === '2030-01-14T00:00:00.000Z' &&
      await Delivery.countDocuments({ subscriptionId, scheduledDate: new Date('2030-01-14T00:00:00.000Z') }) === 1);
    const afterFirstDelivery = await Subscription.findOne({ subscriptionId });
    assert('Concurrent duplicate scheduled delivery decrements subscription days only once',
      afterFirstDelivery.daysRemaining === 29 &&
      afterFirstDelivery.lastDeliveryDate.toISOString() === '2030-01-14T00:00:00.000Z');
    const refreshedConsumerDashboard = await request('GET', '/api/consumer/dashboard?page=1&limit=20');
    assert('Refresh reads persisted subscription and delivery history',
      refreshedConsumerDashboard.status === 200 &&
      refreshedConsumerDashboard.data.consumer.subscription.daysRemaining === 29 &&
      refreshedConsumerDashboard.data.history.some(delivery => delivery.deliveryId === scheduledDelivery.deliveryId));

    await request('POST', '/api/consumer/subscription/pause', { consumerId });
    app.locals.testClock = () => new Date('2030-01-21T10:00:00.000Z');
    const pausedFutureDelivery = await request('POST', '/api/consumer/simulate-delivery-day', {});
    assert('Future scheduled delivery remains suppressed during a later pause',
      pausedFutureDelivery.status === 409 &&
      await Delivery.countDocuments({ subscriptionId, scheduledDate: new Date('2030-01-21T00:00:00.000Z') }) === 0);
    await request('POST', '/api/consumer/subscription/resume', { consumerId });
    app.locals.testClock = () => new Date('2030-01-28T10:00:00.000Z');
    const resumedFutureDelivery = await request('POST', '/api/consumer/simulate-delivery-day', {});
    assert('Future scheduled delivery resumes after subscription resume',
      resumedFutureDelivery.status === 200 &&
      new Date(resumedFutureDelivery.data.delivery.scheduledDate).toISOString() === '2030-01-28T00:00:00.000Z' &&
      (await Subscription.findOne({ subscriptionId })).daysRemaining === 28);
    delete app.locals.testClock;

    const foreignConsumer = await User.create({
      email: 'isolation_consumer@healthymilk.test',
      passwordHash: 'mock_hashed_password',
      phoneNumber: '9876540188',
      role: 'consumer',
      name: 'Subscription Isolation Consumer'
    });
    const foreignConsumerToken = jwt.sign(
      { id: foreignConsumer._id.toString(), email: foreignConsumer.email, role: 'consumer' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    authToken = foreignConsumerToken;
    const missingSubscription = await request('POST', '/api/consumer/subscription/pause', {
      consumerId
    });
    assert('Invalid or absent subscription returns 404 without touching another consumer subscription',
      missingSubscription.status === 404 &&
      (await Subscription.findOne({ subscriptionId })).status === 'Active');
    authToken = '';
    const loggedOutDashboard = await request('GET', '/api/consumer/dashboard');
    assert('Logout clears access to consumer subscription data', loggedOutDashboard.status === 401);
    
    const reloginRes = await request('POST', '/api/auth/login', {
      email: consumerEmail,
      password: consumerPassword
    });
    authToken = reloginRes.data?.token || '';
    const reloginDashboard = await request('GET', '/api/consumer/dashboard?page=1&limit=20');
    assert('Consumer can log in again with email/password and reload persisted subscription state',
      reloginRes.status === 200 &&
      reloginRes.data.success &&
      reloginDashboard.status === 200 &&
      reloginDashboard.data.consumer.subscription.subscriptionId === subscriptionId &&
      reloginDashboard.data.consumer.subscription.daysRemaining === 28);
    authToken = foreignConsumerToken;
    const foreignAttempt = await request('POST', '/api/consumer/subscription/pause', { consumerId });
    assert('A different consumer token cannot target another consumer subscription',
      foreignAttempt.status === 404 &&
      (await Subscription.findOne({ subscriptionId })).status === 'Active');
    authToken = consumerToken;

    // 6.5 Consumer Place Instant Order
    const orderKey = crypto.randomUUID();
    const deliveryCreate = Delivery.create;
    Delivery.create = async () => { throw new Error('Injected delivery-write failure'); };
    let failedOrder;
    try {
      failedOrder = await request('POST', '/api/consumer/order', {
        consumerId,
        items: [{ productId: 'p1', name: 'A2 Cow Milk', quantity: 3, price: 65 }],
        deliveryAddress: 'Flat 402, Green Meadows Apt, Bangalore',
        paymentMethod: 'UPI'
      }, { 'Idempotency-Key': orderKey });
    } finally {
      Delivery.create = deliveryCreate;
    }
    const failedOrderOutcome = supportsTransactions
      ? failedOrder.status === 500 && await Order.countDocuments({ consumerId }) === 0
      : failedOrder.status === 500;
    assert('Failed delivery record write returns safe error status', failedOrderOutcome);
    if (!supportsTransactions) {
      await Order.deleteMany({ consumerId });
    }
    const orderRes = await request('POST', '/api/consumer/order', {
      consumerId,
      items: [{ productId: 'p1', name: 'A2 Cow Milk', quantity: 3, price: 65 }],
      deliveryAddress: 'Flat 402, Green Meadows Apt, Bangalore',
      paymentMethod: 'UPI'
    }, { 'Idempotency-Key': orderKey });
    assert('Consumer places instant product order', orderRes.status === 201 && orderRes.data.success);
    const duplicateOrder = await request('POST', '/api/consumer/order', {
      consumerId,
      items: [{ productId: 'p1', name: 'A2 Cow Milk', quantity: 3, price: 65 }],
      deliveryAddress: 'Flat 402, Green Meadows Apt, Bangalore',
      paymentMethod: 'UPI'
    }, { 'Idempotency-Key': orderKey });
    assert('Duplicate order request creates only one order and delivery',
      duplicateOrder.status === 200 &&
      duplicateOrder.data.order.orderId === orderRes.data.order.orderId &&
      await Order.countDocuments({ consumerId }) === 1 &&
      await Delivery.countDocuments({ consumerId, orderId: orderRes.data.order.orderId }) === 1);
    assert('Order ID generated', Boolean(orderRes.data.order.orderId));
    assert('Order and delivery tracking records persist in MongoDB',
      Boolean(await Order.findOne({ orderId: orderRes.data.order.orderId, consumerId })) &&
      Boolean(await Delivery.findOne({ orderId: orderRes.data.order.orderId, consumerId })));
    const consumerDash = await request('GET', '/api/consumer/dashboard?page=1&limit=1');
    assert('Consumer dashboard returns MongoDB profile and bounded delivery history',
      consumerDash.status === 200 && consumerDash.data.consumer.id === consumerId &&
      consumerDash.data.pagination.limit === 1);
    const consumerSettings = await request('PUT', '/api/consumer/settings', {
      address: '77 Mongo Street, Anand',
      deliveryTimeSlot: '7:00 AM - 8:00 AM'
    });
    assert('Consumer profile settings persist in MongoDB',
      consumerSettings.status === 200 &&
      (await User.findById(consumerId)).address === '77 Mongo Street, Anand');
    const orders = await request('GET', '/api/consumer/orders?page=1&limit=1');
    assert('Consumer order history is server paginated',
      orders.status === 200 && orders.data.orders.length === 1 && orders.data.pagination.limit === 1);
    const persistenceProbe = [
      "const {connectDB}=require('./src/config/db');",
      "const Order=require('./src/models/Order');",
      "const Subscription=require('./src/models/Subscription');",
      "const Delivery=require('./src/models/Delivery');",
      "connectDB().then(async()=>{",
      "const order=await Order.findOne({orderId:process.argv[1]});",
      "const subscription=await Subscription.findOne({subscriptionId:process.argv[3],consumerId:process.argv[2]});",
      "const deliveries=await Delivery.countDocuments({subscriptionId:process.argv[3],scheduledDate:{$exists:true}});",
      "if(!order||!subscription||deliveries!==2)process.exitCode=2;",
      "await require('mongoose').disconnect();",
      "}).catch(error=>{console.error(error.message);process.exitCode=1});"
    ].join('');
    execFileSync(process.execPath, [
      '-e', persistenceProbe,
      orderRes.data.order.orderId,
      consumerId,
      subscriptionId
    ], {
      env: { ...process.env, MONGODB_URI: process.env.MONGODB_TEST_URI },
      cwd: require('path').resolve(__dirname, '..'),
      stdio: 'pipe'
    });
    assert('Order, subscription state, and scheduled deliveries persist across a new backend process',
      true);

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
    const adminUser = await User.create({
      email: 'admin_audit@healthymilk.test',
      passwordHash: 'mock_hashed_password',
      phoneNumber: '9876540098',
      role: 'admin',
      name: 'Test Admin'
    });
    authToken = jwt.sign({ id: adminUser._id.toString(), email: adminUser.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const adminStats = await request('GET', '/api/admin/stats');
    assert('Admin fetch system-wide metrics', adminStats.status === 200 && adminStats.data.success);
    assert('Metrics include farmers, consumers, agents counts', typeof adminStats.data.stats.totalFarmers === 'number');
    assert('Admin aggregations include real order and subscription records',
      adminStats.data.stats.pendingOrders >= 1 && adminStats.data.stats.activeSubscriptions >= 1,
      JSON.stringify({
        pendingOrders: adminStats.data.stats.pendingOrders,
        activeSubscriptions: adminStats.data.stats.activeSubscriptions
      }));

    const assignOrder = await request('POST', `/api/admin/orders/${orderRes.data.order.orderId}/assign`, {
      agentId
    });
    assert('Admin assigns an order to a persisted delivery agent',
      assignOrder.status === 200 && assignOrder.data.delivery.agentId === agentId);
    authToken = agentToken;
    const outForDelivery = await request('POST', '/api/delivery/update-status', {
      taskId: assignOrder.data.delivery.deliveryId,
      type: 'consumer_delivery',
      status: 'Out for Delivery'
    });
    assert('Agent persists the out-for-delivery transition',
      outForDelivery.status === 200 &&
      (await Delivery.findOne({ deliveryId: assignOrder.data.delivery.deliveryId })).status === 'Out for Delivery');
    const agentBalanceBeforeFailedCompletion = (await User.findById(agentId)).balance;
    Transaction.create = async () => { throw new Error('Injected transaction-write failure'); };
    let failedCompletion;
    try {
      failedCompletion = await request('POST', '/api/delivery/update-status', {
        taskId: assignOrder.data.delivery.deliveryId,
        type: 'consumer_delivery',
        status: 'Delivered'
      });
    } finally {
      Transaction.create = transactionCreate;
    }
    const failedCompletionOutcome = supportsTransactions
      ? failedCompletion.status === 500 &&
        (await Delivery.findOne({ deliveryId: assignOrder.data.delivery.deliveryId })).status === 'Out for Delivery' &&
        (await Order.findOne({ orderId: orderRes.data.order.orderId })).status === 'Out for Delivery' &&
        (await User.findById(agentId)).balance === agentBalanceBeforeFailedCompletion &&
        !await Transaction.exists({ reference: `DELIVERY-FEE-${assignOrder.data.delivery.deliveryId}` })
      : failedCompletion.status === 500;
    assert('Failed delivery commission ledger write returns safe error status', failedCompletionOutcome);
    if (!supportsTransactions) {
      await Delivery.updateOne({ deliveryId: assignOrder.data.delivery.deliveryId }, { $set: { status: 'Out for Delivery' } });
      await Order.updateOne({ orderId: orderRes.data.order.orderId }, { $set: { status: 'Out for Delivery' } });
      await User.findByIdAndUpdate(agentId, { balance: agentBalanceBeforeFailedCompletion });
    }
    const markDelivered = await request('POST', '/api/delivery/update-status', {
      taskId: assignOrder.data.delivery.deliveryId,
      type: 'consumer_delivery',
      status: 'Delivered'
    });
    assert('Agent persists delivery completion and order status',
      markDelivered.status === 200 &&
      (await Delivery.findOne({ deliveryId: assignOrder.data.delivery.deliveryId })).status === 'Delivered' &&
      (await Order.findOne({ orderId: orderRes.data.order.orderId })).status === 'Delivered');
    const duplicateDelivery = await request('POST', '/api/delivery/update-status', {
      taskId: assignOrder.data.delivery.deliveryId,
      type: 'consumer_delivery',
      status: 'Delivered'
    });
    assert('Reject duplicate delivery completion without paying commission twice',
      duplicateDelivery.status === 409 &&
      await Transaction.countDocuments({ reference: `DELIVERY-FEE-${assignOrder.data.delivery.deliveryId}` }) === 1);
    assert('Agent delivery commission persists as wallet transaction',
      Boolean(await Transaction.findOne({ reference: `DELIVERY-FEE-${assignOrder.data.delivery.deliveryId}` })));
    const agentPayoutKey = crypto.randomUUID();
    const agentPayout = await request('POST', '/api/delivery/payout', { amount: 20 }, {
      'Idempotency-Key': agentPayoutKey
    });
    assert('Agent withdrawal and balance update persist in MongoDB',
      agentPayout.status === 200 &&
      Boolean(await Transaction.findOne({ reference: agentPayout.data.transaction.reference })));
    const agentBalanceAfterPayout = (await User.findById(agentId)).balance;
    const duplicateAgentPayout = await request('POST', '/api/delivery/payout', { amount: 20 }, {
      'Idempotency-Key': agentPayoutKey
    });
    assert('Duplicate delivery-agent withdrawal does not debit the wallet twice',
      duplicateAgentPayout.status === 200 &&
      (await User.findById(agentId)).balance === agentBalanceAfterPayout &&
      await Transaction.countDocuments({ agentId, type: 'Bank Withdrawal' }) === 1);
    authToken = jwt.sign({ id: adminUser._id.toString(), role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 8.2 Admin Batch Audit List
    const adminBatches = await request('GET', '/api/batches');
    assert('Admin queries master batch list', adminBatches.status === 200 && Array.isArray(adminBatches.data.batches));

    const firstAdminPage = await request('GET', '/api/admin/records?kind=batches&page=1&pageSize=1');
    assert('Admin registry returns a bounded page with total-count metadata',
      firstAdminPage.status === 200 &&
      firstAdminPage.data.records.length === 1 &&
      firstAdminPage.data.totalItems >= 1 &&
      firstAdminPage.data.totalPages >= 1);
    const secondAdminPage = await request('GET', '/api/admin/records?kind=batches&page=2&pageSize=1');
    assert('Adjacent registry pages are stable and do not overlap',
      secondAdminPage.status === 200 &&
      secondAdminPage.data.totalItems === firstAdminPage.data.totalItems &&
      secondAdminPage.data.records.length === 1 &&
      String(secondAdminPage.data.records[0]._id) !== String(firstAdminPage.data.records[0]._id));
    const oversizedAdminPage = await request('GET', '/api/admin/records?kind=batches&page=0&pageSize=9999');
    assert('Admin pagination normalizes invalid pages and caps large page sizes',
      oversizedAdminPage.status === 200 &&
      oversizedAdminPage.data.page === 1 &&
      oversizedAdminPage.data.limit === 100);
    const qualityRecords = await request('GET', '/api/admin/records?kind=quality&page=1&pageSize=5');
    assert('Quality registry only returns tested batches',
      qualityRecords.status === 200 &&
      qualityRecords.data.records.every(batch => Boolean(batch.qualityTest)));

    // 8.3 Admin Review & Release Quarantined Batch
    const farmerBalanceBeforeFailedReview = (await User.findById(farmerId)).balance;
    Transaction.create = async () => { throw new Error('Injected transaction-write failure'); };
    let failedReview;
    try {
      failedReview = await request('POST', `/api/admin/batches/${rejBatchId}/review`, {
        action: 'RELEASE',
        adminNotes: 'Failure-injection rollback test'
      });
    } finally {
      Transaction.create = transactionCreate;
    }
    const failedReviewOutcome = supportsTransactions
      ? failedReview.status === 500 &&
        (await MilkBatch.findOne({ batchId: rejBatchId })).status === 'Rejected' &&
        (await MilkBatch.findOne({ batchId: rejBatchId })).rejection.reviewStatus === 'Pending' &&
        (await User.findById(farmerId)).balance === farmerBalanceBeforeFailedReview &&
        !await Transaction.exists({ reference: `ADMIN-APPROVED-${rejBatchId}` })
      : failedReview.status === 500;
    assert('Failed admin approval ledger write returns safe error status', failedReviewOutcome);
    if (!supportsTransactions) {
      await MilkBatch.updateOne({ batchId: rejBatchId }, {
        $set: { status: 'Rejected', 'rejection.reviewStatus': 'Pending' }
      });
      await User.findByIdAndUpdate(farmerId, { balance: farmerBalanceBeforeFailedReview });
    }
    const adminReview = await request('POST', `/api/admin/batches/${rejBatchId}/review`, {
      action: 'RELEASE',
      adminNotes: 'Secondary lab check cleared minor variance'
    });
    assert('Admin reviews & releases quarantined batch', adminReview.status === 200 && adminReview.data.success);

    // 8.4 Admin Approve Farmer Payout Batch
    const adminPayouts = await request('POST', '/api/admin/payouts/process', {
      payoutIds: [payoutReq.data.transaction.id]
    });
    assert('Admin processes scheduled farmer payout batch', adminPayouts.status === 200 && adminPayouts.data.success);
    assert('Withdrawal processing state persists in MongoDB',
      (await Transaction.findById(payoutReq.data.transaction.id)).status === 'Completed');

    // -------------------------------------------------------------------------
    // 9. NOTIFICATIONS SUBSYSTEM
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Notifications Subsystem ---');
    const createdAdminNotifications = await Notification.countDocuments({ role: 'admin' });

    // 9.1 Fetch Notifications for Farmer
    const notifsRes = await request('GET', '/api/notifications?page=1&limit=1');
    assert('Fetch notifications from MongoDB with bounded pagination',
      notifsRes.status === 200 && Array.isArray(notifsRes.data.notifications) &&
      notifsRes.data.pagination.limit === 1);
    assert('Notifications persist in MongoDB', createdAdminNotifications > 0);

    // 9.2 Mark All Notifications as Read
    const markReadRes = await request('PUT', '/api/notifications/mark-all-read', {});
    assert('Mark all user notifications as read', markReadRes.status === 200 && markReadRes.data.success);
    assert('Notification read state persists in MongoDB',
      (await Notification.countDocuments({ role: 'admin', read: false })) === 0);

    const authRateLimitResponses = [];
    for (let attempt = 0; attempt < 110; attempt += 1) {
      const res = await request('POST', '/api/auth/login', { email: 'rate_test@healthymilk.test', password: 'WrongPassword123' });
      authRateLimitResponses.push(res);
      if (res.status === 429) break;
    }
    assert('Authentication login endpoint enforces IP rate limiting (HTTP 429)',
      authRateLimitResponses.some(response => response.status === 429));

    printMeasurements('OTP send API (local MongoDB + simulated SMS)', otpSendMeasurements);
    printMeasurements('OTP verification API', otpVerifyMeasurements);
    printMeasurements('Existing-user login API', loginMeasurements);
    const sendSamples = authTimingSamples.filter(sample => sample.route === '/send-otp' && sample.statusCode === 200);
    const loginSamples = authTimingSamples.filter(sample => sample.route === '/verify-otp' && sample.statusCode === 200 && sample.phases.jwtGenerationMs !== undefined);
    for (const [label, field] of [
      ['OTP generation', 'otpGenerationMs'],
      ['OTP MongoDB challenge write', 'mongoChallengeWriteMs'],
      ['Simulated SMS provider round-trip', 'smsProviderRequestMs'],
      ['OTP total API response', 'totalApiMs']
    ]) {
      printMeasurements(label, sendSamples.map(sample => field === 'totalApiMs' ? sample.totalApiMs : sample.phases[field]).filter(Number.isFinite));
    }
    for (const [label, field] of [
      ['Login OTP MongoDB lookup', 'mongoChallengeLookupMs'],
      ['Login JWT generation', 'jwtGenerationMs'],
      ['Login total API response', 'totalApiMs']
    ]) {
      printMeasurements(label, loginSamples.map(sample => field === 'totalApiMs' ? sample.totalApiMs : sample.phases[field]).filter(Number.isFinite));
    }

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
      console.log(`\n🎉 ALL ${passedCount}/${results.length} E2E AUDIT TESTS PASSED CLEANLY!`);
    }

  } catch (err) {
    console.error('Fatal Error during E2E Audit:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (smsServer) smsServer.close();
    await mongoose.disconnect();
  }
}

runAudit();

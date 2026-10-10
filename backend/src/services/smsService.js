const https = require('https');
const http = require('http');
const httpsAgent = new https.Agent({ keepAlive: true });
const httpAgent = new http.Agent({ keepAlive: true });

function setRequestDeadline(req, timeoutMs) {
  const timeoutId = setTimeout(() => {
    req.destroy(new Error('SMS gateway request timed out'));
  }, timeoutMs);
  req.once('close', () => clearTimeout(timeoutId));
}

const RESPONSE_BODY_LIMIT = 16 * 1024;

function getSmsConfigurationStatus() {
  const providers = [
    {
      name: 'twilio',
      variables: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
    },
    { name: 'fast2sms', variables: ['FAST2SMS_API_KEY'] },
    { name: 'msg91', variables: ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'] },
    { name: 'custom_gateway', variables: ['SMS_API_URL'] }
  ];
  const configured = providers.find(provider =>
    provider.variables.every(name => Boolean(process.env[name]?.trim()))
  );
  const invalidSettings = configured?.name === 'custom_gateway' &&
    process.env.SMS_API_METHOD &&
    process.env.SMS_API_METHOD.trim().toUpperCase() !== 'POST'
      ? ['SMS_API_METHOD must be POST so OTPs are not placed in URLs.']
      : [];

  return {
    configured: Boolean(configured) && invalidSettings.length === 0,
    provider: configured?.name || 'none',
    invalidSettings,
    providers: providers.map(provider => ({
      name: provider.name,
      configured: provider.variables.every(name => Boolean(process.env[name]?.trim())),
      missingVariables: provider.variables.filter(name => !process.env[name]?.trim())
    }))
  };
}

function redactProviderText(value) {
  let text = String(value || '').slice(0, 240);
  for (const name of [
    'TWILIO_AUTH_TOKEN',
    'FAST2SMS_API_KEY',
    'MSG91_AUTH_KEY',
    'SMS_API_KEY'
  ]) {
    const secret = process.env[name];
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text.replace(/\b\d{4,}\b/g, '[redacted]');
}

function redactProviderIdentifier(value, toPhone, otp) {
  let text = String(value || '').slice(0, 128);
  for (const name of [
    'TWILIO_AUTH_TOKEN',
    'FAST2SMS_API_KEY',
    'MSG91_AUTH_KEY',
    'SMS_API_KEY'
  ]) {
    const secret = process.env[name];
    if (secret) text = text.split(secret).join('[redacted]');
  }
  const digits = String(toPhone || '').replace(/[^\d]/g, '');
  for (const sensitive of [otp, digits, digits && `+${digits}`]) {
    if (sensitive) text = text.split(String(sensitive)).join('[redacted]');
  }
  return /^[A-Za-z0-9._:-]{1,128}$/.test(text) ? text : null;
}

function providerResponseResult(provider, httpStatus, responseBody, toPhone, otp, bodyTooLarge = false) {
  let payload = null;
  try {
    payload = JSON.parse(responseBody);
  } catch {}

  const httpAccepted = httpStatus >= 200 && httpStatus < 300;
  let providerAccepted = false;
  let providerStatus = 'REJECTED';
  if (!bodyTooLarge && payload && typeof payload === 'object') {
    if (provider === 'twilio') {
      providerStatus = String(payload.status || 'UNKNOWN').toUpperCase();
      providerAccepted = Boolean(payload.sid) &&
        ['ACCEPTED', 'QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED'].includes(providerStatus);
    } else if (provider === 'fast2sms') {
      providerAccepted = payload.return === true;
      providerStatus = providerAccepted ? 'ACCEPTED' : 'REJECTED';
    } else if (provider === 'msg91') {
      providerStatus = String(payload.type || 'UNKNOWN').toUpperCase();
      providerAccepted = providerStatus === 'SUCCESS';
    } else {
      const status = String(payload.status || '').toLowerCase();
      const explicitFailure = ['failed', 'failure', 'rejected', 'undelivered', 'error'].includes(status);
      providerAccepted = !explicitFailure && (
        payload.success === true ||
        payload.accepted === true ||
        ['accepted', 'queued', 'sent'].includes(status)
      );
      providerStatus = providerAccepted
        ? String(payload.status || 'ACCEPTED').toUpperCase()
        : String(payload.status || 'REJECTED').toUpperCase();
    }
  } else if (bodyTooLarge) {
    providerStatus = 'RESPONSE_TOO_LARGE';
  } else if (httpAccepted) {
    providerStatus = 'INVALID_RESPONSE';
  }

  const rawMessage = payload?.message || payload?.error || payload?.messages?.[0] || '';
  const rawErrorCode = payload?.error_code ?? payload?.errorCode ?? payload?.code ?? null;
  const rawMessageId = payload?.sid || payload?.request_id || payload?.message_id || payload?.messageId || null;

  return {
    success: httpAccepted && providerAccepted,
    provider,
    httpStatus,
    providerStatus,
    messageId: redactProviderIdentifier(rawMessageId, toPhone, otp),
    errorCode: rawErrorCode == null
      ? httpAccepted ? null : `HTTP_${httpStatus}`
      : redactProviderIdentifier(rawErrorCode, toPhone, otp),
    providerMessage: redactProviderText(rawMessage),
    error: httpAccepted && providerAccepted
      ? undefined
      : redactProviderText(rawMessage) || `Provider request was not accepted (HTTP ${httpStatus}).`
  };
}

function collectProviderResponse(provider, response, resolve, toPhone, otp) {
  let body = '';
  let size = 0;
  let bodyTooLarge = false;
  response.on('data', chunk => {
    size += chunk.length;
    if (size > RESPONSE_BODY_LIMIT) {
      bodyTooLarge = true;
      return;
    }
    body += chunk;
  });
  response.on('end', () => {
    resolve(providerResponseResult(provider, response.statusCode || 0, body, toPhone, otp, bodyTooLarge));
  });
}

function logProviderResult(result, maskedPhone) {
  console.info('OTP SMS provider', {
    destination: maskedPhone,
    provider: result.provider,
    httpStatus: result.httpStatus,
    status: result.providerStatus,
    messageId: result.messageId,
    errorCode: result.errorCode,
    message: result.providerMessage || undefined
  });
}

/**
 * Production Real SMS Delivery Service
 * Supports Twilio, Fast2SMS (India), MSG91, and Custom HTTP SMS Gateways.
 * Equipped with strict 3500ms network timeout so gateway delays never hang the API.
 */
const sendSMS = async ({ toPhone, otp }) => {
  const suppliedDigits = String(toPhone || '').replace(/[^\d]/g, '');
  const cleanPhone = suppliedDigits.length === 12 && suppliedDigits.startsWith('91')
    ? suppliedDigits.slice(2)
    : suppliedDigits;
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return { success: false, provider: 'none', error: 'Invalid Indian mobile number.' };
  }
  const fullPhone = `+91${cleanPhone}`;
  const maskedPhone = `******${cleanPhone.slice(-4)}`;
  const message = `Your HealthyMilk verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

  const GATEWAY_TIMEOUT_MS = 3500;

  // 1. Twilio SMS Integration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (getSmsConfigurationStatus().provider === 'twilio') {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const postData = new URLSearchParams({
        To: fullPhone,
        From: twilioPhone,
        Body: message
      }).toString();

      const result = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.twilio.com',
          path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          method: 'POST',
          agent: httpsAgent,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, res => collectProviderResponse('twilio', res, resolve, cleanPhone, otp));

        setRequestDeadline(req, GATEWAY_TIMEOUT_MS);

        req.on('error', (err) => {
          resolve({
            success: false,
            provider: 'twilio',
            httpStatus: null,
            providerStatus: 'REQUEST_FAILED',
            errorCode: err.code || err.name
          });
        });

        req.write(postData);
        req.end();
      });

      logProviderResult(result, maskedPhone);
      return result;
    } catch (e) {
      console.error('Twilio SMS request failed', { code: e.code || e.name });
      return { success: false, provider: 'twilio', error: e.message };
    }
  }

  // 2. Fast2SMS API Integration (India 10-Digit Mobile SMS)
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (getSmsConfigurationStatus().provider === 'fast2sms') {
    try {
      const postData = JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: cleanPhone
      });

      const result = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'www.fast2sms.com',
          path: '/dev/bulkV2',
          method: 'POST',
          agent: httpsAgent,
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, res => collectProviderResponse('fast2sms', res, resolve, cleanPhone, otp));

        setRequestDeadline(req, GATEWAY_TIMEOUT_MS);

        req.on('error', (err) => {
          resolve({
            success: false,
            provider: 'fast2sms',
            httpStatus: null,
            providerStatus: 'REQUEST_FAILED',
            errorCode: err.code || err.name
          });
        });

        req.write(postData);
        req.end();
      });

      logProviderResult(result, maskedPhone);
      return result;
    } catch (e) {
      console.error('Fast2SMS request failed', { code: e.code || e.name });
      return { success: false, provider: 'fast2sms', error: e.message };
    }
  }

  // 3. MSG91 SMS API Integration
  const msg91Key = process.env.MSG91_AUTH_KEY;
  const msg91Template = process.env.MSG91_TEMPLATE_ID;
  if (getSmsConfigurationStatus().provider === 'msg91') {
    try {
      const postData = JSON.stringify({
        template_id: msg91Template,
        mobile: `91${cleanPhone}`,
        otp: otp
      });

      const result = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'control.msg91.com',
          path: '/api/v5/otp',
          method: 'POST',
          agent: httpsAgent,
          headers: {
            'authkey': msg91Key,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, res => collectProviderResponse('msg91', res, resolve, cleanPhone, otp));

        setRequestDeadline(req, GATEWAY_TIMEOUT_MS);

        req.on('error', (err) => {
          resolve({
            success: false,
            provider: 'msg91',
            httpStatus: null,
            providerStatus: 'REQUEST_FAILED',
            errorCode: err.code || err.name
          });
        });

        req.write(postData);
        req.end();
      });

      logProviderResult(result, maskedPhone);
      return result;
    } catch (e) {
      console.error('MSG91 request failed', { code: e.code || e.name });
      return { success: false, provider: 'msg91', error: e.message };
    }
  }

  // 4. Custom HTTP Gateway API URL
  const smsApiUrl = process.env.SMS_API_URL;
  if (getSmsConfigurationStatus().provider === 'custom_gateway') {
    try {
      const method = (process.env.SMS_API_METHOD || 'POST').toUpperCase();
      if (method !== 'POST') {
        const result = {
          success: false,
          provider: 'custom_gateway',
          httpStatus: null,
          providerStatus: 'CONFIGURATION_ERROR',
          errorCode: 'SMS_API_METHOD_MUST_BE_POST'
        };
        logProviderResult(result, maskedPhone);
        return result;
      }
      const targetUrl = smsApiUrl
        .replace('{to}', encodeURIComponent(cleanPhone))
        .replace('{phone}', encodeURIComponent(fullPhone));
      const postData = JSON.stringify({ to: fullPhone, phone: cleanPhone, otp, message });

      const isHttps = targetUrl.startsWith('https');
      const httpModule = isHttps ? https : http;

      const result = await new Promise((resolve) => {
        const req = httpModule.request(targetUrl, {
          method,
          agent: isHttps ? httpsAgent : httpAgent,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            ...(process.env.SMS_API_KEY ? { 'X-API-Key': process.env.SMS_API_KEY } : {})
          }
        }, res => collectProviderResponse('custom_gateway', res, resolve, cleanPhone, otp));

        setRequestDeadline(req, GATEWAY_TIMEOUT_MS);

        req.on('error', (err) => {
          resolve({
            success: false,
            provider: 'custom_gateway',
            httpStatus: null,
            providerStatus: 'REQUEST_FAILED',
            errorCode: err.code || err.name
          });
        });
        req.write(postData);
        req.end();
      });

      logProviderResult(result, maskedPhone);
      return result;
    } catch (e) {
      console.error('Custom SMS gateway request failed', { code: e.code || e.name });
      return { success: false, provider: 'custom_gateway', error: e.message };
    }
  }

  // Fallback when no SMS provider credentials are set
  return {
    success: false,
    provider: 'none',
    error: 'SMS Provider credentials not configured in backend environment (.env). Please set FAST2SMS_API_KEY, TWILIO, MSG91, or SMS_API_URL.'
  };
};

module.exports = {
  sendSMS,
  getSmsConfigurationStatus
};

const https = require('https');
const http = require('http');

/**
 * Production Real SMS Delivery Service
 * Supports Twilio, Fast2SMS (India), MSG91, and Custom HTTP SMS Gateways.
 */
const sendSMS = async ({ toPhone, otp }) => {
  const cleanPhone = toPhone.toString().replace(/[^\d]/g, '');
  const fullPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
  const message = `Your HealthyMilk verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

  console.log("--------------------------------------------------");
  console.log("📱 [SMS SERVICE] OTP Request Received");
  console.log("Phone:", fullPhone);
  console.log("OTP generated successfully");
  console.log("--------------------------------------------------");

  // 1. Twilio SMS Integration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioPhone) {
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
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log("SMS provider status:", res.statusCode);
            console.log("SMS provider response:", data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, provider: 'twilio', data });
            } else {
              resolve({ success: false, provider: 'twilio', error: data || `HTTP ${res.statusCode}` });
            }
          });
        });

        req.on('error', (err) => {
          console.error("SMS provider error:", err.message);
          resolve({ success: false, provider: 'twilio', error: err.message });
        });

        req.write(postData);
        req.end();
      });

      return result;
    } catch (e) {
      console.error('Twilio SMS exception:', e);
      return { success: false, provider: 'twilio', error: e.message };
    }
  }

  // 2. Fast2SMS API Integration (India 10-Digit Mobile SMS)
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && cleanPhone.length === 10) {
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
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log("SMS provider status:", res.statusCode);
            console.log("SMS provider response:", data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, provider: 'fast2sms', data });
            } else {
              resolve({ success: false, provider: 'fast2sms', error: data || `HTTP ${res.statusCode}` });
            }
          });
        });

        req.on('error', (err) => {
          console.error("SMS provider error:", err.message);
          resolve({ success: false, provider: 'fast2sms', error: err.message });
        });

        req.write(postData);
        req.end();
      });

      return result;
    } catch (e) {
      console.error('Fast2SMS exception:', e);
      return { success: false, provider: 'fast2sms', error: e.message };
    }
  }

  // 3. MSG91 SMS API Integration
  const msg91Key = process.env.MSG91_AUTH_KEY;
  const msg91Template = process.env.MSG91_TEMPLATE_ID;
  if (msg91Key && msg91Template && cleanPhone.length === 10) {
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
          headers: {
            'authkey': msg91Key,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log("SMS provider status:", res.statusCode);
            console.log("SMS provider response:", data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, provider: 'msg91', data });
            } else {
              resolve({ success: false, provider: 'msg91', error: data || `HTTP ${res.statusCode}` });
            }
          });
        });

        req.on('error', (err) => {
          console.error("SMS provider error:", err.message);
          resolve({ success: false, provider: 'msg91', error: err.message });
        });

        req.write(postData);
        req.end();
      });

      return result;
    } catch (e) {
      console.error('MSG91 exception:', e);
      return { success: false, provider: 'msg91', error: e.message };
    }
  }

  // 4. Custom HTTP Gateway API URL
  const smsApiUrl = process.env.SMS_API_URL;
  if (smsApiUrl) {
    try {
      const targetUrl = smsApiUrl
        .replace('{to}', encodeURIComponent(cleanPhone))
        .replace('{phone}', encodeURIComponent(fullPhone))
        .replace('{otp}', encodeURIComponent(otp))
        .replace('{msg}', encodeURIComponent(message));

      const isHttps = targetUrl.startsWith('https');
      const httpModule = isHttps ? https : http;

      const result = await new Promise((resolve) => {
        httpModule.get(targetUrl, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log("SMS provider status:", res.statusCode);
            console.log("SMS provider response:", data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, provider: 'custom_gateway', data });
            } else {
              resolve({ success: false, provider: 'custom_gateway', error: data || `HTTP ${res.statusCode}` });
            }
          });
        }).on('error', (err) => {
          console.error("SMS provider error:", err.message);
          resolve({ success: false, provider: 'custom_gateway', error: err.message });
        });
      });

      return result;
    } catch (e) {
      console.error('Custom SMS Gateway exception:', e);
      return { success: false, provider: 'custom_gateway', error: e.message };
    }
  }

  // Explicit failure if no SMS provider environment variable is configured
  console.warn("⚠️ [SMS SERVICE] No SMS API credentials set in backend environment!");
  return {
    success: false,
    provider: 'none',
    error: 'SMS Provider credentials not configured in backend environment (.env). Please set FAST2SMS_API_KEY, TWILIO, MSG91, or SMS_API_URL.'
  };
};

module.exports = {
  sendSMS
};

const https = require('https');
const http = require('http');

/**
 * Production SMS Delivery Service
 * Supports Twilio, Fast2SMS (India), MSG91, and Generic HTTP SMS Gateways.
 */
const sendSMS = async ({ toPhone, otp }) => {
  const cleanPhone = toPhone.replace(/[^\d]/g, '');
  const fullPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
  const message = `Your HealthyMilk verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

  console.log(`📱 [SMS SERVICE] Sending OTP ${otp} to ${fullPhone}...`);

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

      await new Promise((resolve, reject) => {
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
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('✅ Twilio SMS sent successfully!');
              resolve(data);
            } else {
              console.warn('⚠️ Twilio SMS error response:', data);
              resolve(null);
            }
          });
        });

        req.on('error', (err) => {
          console.error('❌ Twilio SMS request error:', err.message);
          resolve(null);
        });

        req.write(postData);
        req.end();
      });
      return { success: true, provider: 'twilio' };
    } catch (e) {
      console.error('Twilio SMS exception:', e);
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

      await new Promise((resolve) => {
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
            console.log('✅ Fast2SMS response:', data);
            resolve(data);
          });
        });
        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
      });
      return { success: true, provider: 'fast2sms' };
    } catch (e) {
      console.error('Fast2SMS exception:', e);
    }
  }

  // 3. Generic HTTP SMS API Gateway (Custom Provider URL)
  const smsApiUrl = process.env.SMS_API_URL; // e.g. https://api.smsprovider.com/send?apiKey=KEY&to={to}&msg={msg}
  if (smsApiUrl) {
    try {
      const targetUrl = smsApiUrl
        .replace('{to}', encodeURIComponent(cleanPhone))
        .replace('{phone}', encodeURIComponent(fullPhone))
        .replace('{otp}', encodeURIComponent(otp))
        .replace('{msg}', encodeURIComponent(message));

      const isHttps = targetUrl.startsWith('https');
      const httpModule = isHttps ? https : http;

      await new Promise((resolve) => {
        httpModule.get(targetUrl, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log('✅ Generic SMS Gateway response:', data);
            resolve(data);
          });
        }).on('error', () => resolve(null));
      });
      return { success: true, provider: 'custom_gateway' };
    } catch (e) {
      console.error('Custom SMS Gateway exception:', e);
    }
  }

  // Fallback logging when no SMS API key environment variable is configured
  console.log(`💡 [DEV SMS SIMULATOR] No SMS API credentials set in .env. OTP for +91 ${cleanPhone} is: ${otp}`);
  return { success: true, provider: 'dev_simulator', simulated: true };
};

module.exports = {
  sendSMS
};

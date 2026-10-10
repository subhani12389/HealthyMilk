const https = require('https');
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

// Test-mode inbox store for automated testing assertions
const testDeliveredEmails = new Map();

/**
 * Helper: Mask email for safe UI display (e.g. sk5826314@gmail.com -> sk***@gmail.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***@***.com';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***@***.com';
  const name = parts[0];
  const domain = parts[1];
  const visiblePrefix = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
  return `${visiblePrefix}***@${domain}`;
}

/**
 * Render responsive HTML email template for HealthyMilk
 */
function renderVerificationEmailHtml({ name, otp, expiresMinutes = 5 }) {
  const displayName = name || 'HealthyMilk Member';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your HealthyMilk Account</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F3F4F6; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F3F4F6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="540" style="max-width: 540px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">🥛</div>
              <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Healthy<span style="color: #A7F3D0;">Milk</span></h1>
              <p style="color: #E6FFFA; font-size: 13px; margin: 4px 0 0 0; font-weight: 500;">Pure, Fresh & Traceable Dairy Ecosystem</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 28px;">
              <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Verify your email address</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4B5563; margin: 0 0 24px 0;">
                Hello <strong>${displayName}</strong>,<br>
                Thank you for joining HealthyMilk. Please use the 6-digit verification code below to activate your account.
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #ECFDF5; border: 2px dashed #10B981; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="display: block; font-size: 12px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your One-Time Code</span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #065F46;">${otp}</span>
              </div>

              <p style="font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0 0 16px 0;">
                ⏱️ This code will expire in <strong>${expiresMinutes} minutes</strong>. For your security, never share this code with anyone.
              </p>
              <p style="font-size: 12px; color: #9CA3AF; line-height: 1.5; margin: 0;">
                If you did not create a HealthyMilk account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 28px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                &copy; ${new Date().getFullYear()} HealthyMilk Inc. Pure Dairy Network.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Plain text alternative for email clients without HTML support
 */
function renderVerificationEmailText({ name, otp, expiresMinutes = 5 }) {
  return `HealthyMilk - Email Verification\n\n` +
    `Hello ${name || 'User'},\n\n` +
    `Your HealthyMilk 6-digit verification code is: ${otp}\n\n` +
    `This code will expire in ${expiresMinutes} minutes.\n` +
    `If you did not request this verification, please ignore this email.\n\n` +
    `HealthyMilk Dairy Ecosystem`;
}

/**
 * Send Verification Email through configured provider
 */
async function sendVerificationEmail({ toEmail, otp, name = 'HealthyMilk User' }) {
  const cleanEmail = (toEmail || '').trim().toLowerCase();
  const expiresMinutes = 5;
  const startedAt = process.hrtime.bigint();

  // Test mode: store in test map without making external network calls
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_EMAIL === 'true') {
    testDeliveredEmails.set(cleanEmail, {
      otp,
      name,
      sentAt: new Date()
    });
    return {
      success: true,
      provider: 'mock',
      providerStatus: 'delivered_to_test_inbox',
      devOtp: otp,
      deliveryDurationMs: Number(process.hrtime.bigint() - startedAt) / 1e6
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || (smtpUser && smtpUser.includes('@gmail.com') ? 'smtp.gmail.com' : '');
  const smtpPort = Number(process.env.SMTP_PORT || (smtpHost === 'smtp.gmail.com' ? 465 : 587));
  const emailFrom = process.env.EMAIL_FROM || (smtpUser ? `HealthyMilk <${smtpUser}>` : 'HealthyMilk <onboarding@resend.dev>');

  // 1. Resend.com Provider
  if (resendApiKey) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        from: emailFrom,
        to: [cleanEmail],
        subject: `Your HealthyMilk Verification Code: ${otp}`,
        html: renderVerificationEmailHtml({ name, otp, expiresMinutes }),
        text: renderVerificationEmailText({ name, otp, expiresMinutes })
      });

      const req = https.request({
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 6000
      }, (res) => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => {
          const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            let parsed = {};
            try { parsed = JSON.parse(resData); } catch (e) {}
            resolve({
              success: true,
              provider: 'resend',
              providerStatus: 'accepted_by_resend',
              messageId: parsed.id,
              httpStatus: res.statusCode,
              deliveryDurationMs: durationMs
            });
          } else {
            console.error('Resend email delivery rejected:', res.statusCode, resData);
            resolve({
              success: false,
              provider: 'resend',
              providerStatus: 'failed',
              httpStatus: res.statusCode,
              deliveryDurationMs: durationMs
            });
          }
        });
      });

      req.on('error', (err) => {
        console.error('Resend network error:', err.message);
        resolve({
          success: false,
          provider: 'resend',
          providerStatus: 'network_error',
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          provider: 'resend',
          providerStatus: 'timeout'
        });
      });

      req.write(payload);
      req.end();
    });
  }

  // 2. SendGrid Provider
  if (sendgridApiKey) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        personalizations: [{ to: [{ email: cleanEmail }] }],
        from: { email: emailFrom.includes('<') ? emailFrom.match(/<([^>]+)>/)[1] : emailFrom, name: 'HealthyMilk' },
        subject: `Your HealthyMilk Verification Code: ${otp}`,
        content: [
          { type: 'text/plain', value: renderVerificationEmailText({ name, otp, expiresMinutes }) },
          { type: 'text/html', value: renderVerificationEmailHtml({ name, otp, expiresMinutes }) }
        ]
      });

      const req = https.request({
        hostname: 'api.sendgrid.com',
        port: 443,
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 6000
      }, (res) => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            provider: 'sendgrid',
            providerStatus: 'accepted_by_sendgrid',
            httpStatus: res.statusCode,
            deliveryDurationMs: durationMs
          });
        } else {
          resolve({
            success: false,
            provider: 'sendgrid',
            providerStatus: 'failed',
            httpStatus: res.statusCode,
            deliveryDurationMs: durationMs
          });
        }
      });

      req.on('error', (err) => {
        resolve({ success: false, provider: 'sendgrid', error: err.message });
      });
      req.write(payload);
      req.end();
    });
  }

  // 3. SMTP / Gmail Provider (Nodemailer)
  if (nodemailer && smtpUser && smtpPass && (smtpHost || smtpUser.includes('@gmail.com'))) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: emailFrom,
        to: cleanEmail,
        subject: `Your HealthyMilk Verification Code: ${otp}`,
        text: renderVerificationEmailText({ name, otp, expiresMinutes }),
        html: renderVerificationEmailHtml({ name, otp, expiresMinutes })
      });

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      console.log(`[Email Service - SMTP] Sent verification OTP to ${cleanEmail}. MessageId: ${info.messageId}`);
      return {
        success: true,
        provider: 'smtp',
        providerStatus: 'sent_via_smtp',
        messageId: info.messageId,
        deliveryDurationMs: durationMs
      };
    } catch (smtpErr) {
      console.error('SMTP Email Send Error:', smtpErr.message);
      // Fall through to dev console so the user is never stuck
    }
  }

  // 4. Fallback when no provider credentials configured in local development
  console.info(`\n===============================================================`);
  console.info(`🥛 [HealthyMilk Email Service] Dev Verification Code`);
  console.info(`   To: ${cleanEmail}`);
  console.info(`   Code: ${otp}`);
  console.info(`   (To send real emails, set RESEND_API_KEY or SMTP_USER & SMTP_PASS in backend/.env)`);
  console.info(`===============================================================\n`);

  return {
    success: true,
    provider: 'dev_console',
    providerStatus: 'logged_to_server_console',
    devOtp: otp,
    deliveryDurationMs: Number(process.hrtime.bigint() - startedAt) / 1e6
  };
}

module.exports = {
  sendVerificationEmail,
  renderVerificationEmailHtml,
  renderVerificationEmailText,
  maskEmail,
  testDeliveredEmails
};

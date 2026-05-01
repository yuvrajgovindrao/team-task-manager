// Generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Build OTP email HTML
function buildOtpHtml(otp) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
      <div style="background: linear-gradient(135deg, #3b82f6, #a855f7); padding: 32px; text-align: center;">
        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; color: white; margin-bottom: 12px;">T</div>
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">TeamFlow</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Email Verification</p>
      </div>
      <div style="padding: 32px; text-align: center;">
        <p style="color: #94a3b8; font-size: 15px; margin: 0 0 24px;">Enter this code to verify your account:</p>
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 0 auto; display: inline-block;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #f1f5f9;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; margin: 24px 0 0;">This code expires in <strong style="color: #f59e0b;">10 minutes</strong></p>
        <p style="color: #475569; font-size: 12px; margin: 16px 0 0;">If you didn't create an account, please ignore this email.</p>
      </div>
    </div>
  `;
}

// Send OTP email via Resend API (HTTPS, works on Railway)
async function sendOTP(email, otp) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email service is not configured. Please set RESEND_API_KEY.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TeamFlow <auth@egodev.in>',
      to: [email],
      subject: 'Your TeamFlow Verification Code',
      html: buildOtpHtml(otp),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('Resend API error:', err);
    throw new Error(`Email send failed: ${err.message || 'Unknown error'}`);
  }

  console.log(`OTP email sent to ${email}`);
}

module.exports = { generateOTP, sendOTP };

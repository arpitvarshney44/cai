/**
 * Connect.AI Email Templates
 * Responsive and modern design with brand colors
 */

const baseLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7ff; margin: 0; padding: 0; color: #333; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #005EFF 0%, #002D7A 100%); padding: 30px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .content h2 { color: #005EFF; margin-top: 0; font-size: 22px; }
    .otp-container { background-color: #f1f6ff; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0; border: 1px dashed #005EFF; }
    .otp-code { font-size: 36px; font-weight: 800; color: #005EFF; letter-spacing: 8px; margin: 0; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #005EFF; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .social-links { margin-top: 10px; }
    .social-links a { color: #005EFF; text-decoration: none; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Connect.AI</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; 2026 Connect.AI. All rights reserved.</p>
      <p>Building meaningful connections in the creator economy.</p>
      <div class="social-links">
        <a href="#">Twitter</a> | <a href="#">Instagram</a> | <a href="#">LinkedIn</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

exports.baseLayout = baseLayout;

exports.verificationOTP = (name, code) => baseLayout(`
  <h2>Hi ${name.split(' ')[0]},</h2>
  <p>Welcome to <strong>Connect.AI</strong>! We're excited to have you on board.</p>
  <p>To get started, please verify your email address using the code below:</p>
  <div class="otp-container">
    <p style="margin-bottom: 10px; color: #6b7280;">Verification Code</p>
    <h1 class="otp-code">${code}</h1>
  </div>
  <p>This code will expire in 10 minutes. If you didn't create an account, you can safely ignore this email.</p>
`);

exports.resendOTP = (name, code) => baseLayout(`
  <h2>Verification Code</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>You requested a new verification code. Here it is:</p>
  <div class="otp-container">
    <h1 class="otp-code">${code}</h1>
  </div>
  <p>If you didn't request this code, please secure your account.</p>
`);

exports.passwordReset = (name, code) => baseLayout(`
  <h2>Reset Your Password</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>We received a request to reset your password for your Connect.AI account. Use the code below to proceed:</p>
  <div class="otp-container">
    <p style="margin-bottom: 10px; color: #6b7280;">Reset Code</p>
    <h1 class="otp-code">${code}</h1>
  </div>
  <p>This code is valid for 10 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
`);

exports.genericNotification = (name, title, message, actionUrl) => baseLayout(`
  <h2>${title}</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>${message}</p>
  ${actionUrl ? `<a href="${actionUrl}" class="btn">View Details</a>` : ''}
`);

exports.welcome = (name) => baseLayout(`
  <h2>Welcome to Connect.AI! 🎉</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>We're thrilled to have you join the <strong>Connect.AI</strong> community — the smartest way to connect brands with creators.</p>
  <p>Here's what you can do next:</p>
  <ul style="padding-left: 20px; color: #4b5563;">
    <li>Complete your profile to get discovered</li>
    <li>Explore campaigns that match your niche</li>
    <li>Use AI tools to optimize your pricing and content</li>
  </ul>
  <a href="#" class="btn">Complete Your Profile</a>
  <p style="margin-top: 30px; color: #9ca3af; font-size: 13px;">Need help? Reply to this email or visit our support center.</p>
`);

exports.campaignApproved = (name, campaignTitle) => baseLayout(`
  <h2>Campaign Approved! ✅</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>Great news! Your campaign <strong>"${campaignTitle}"</strong> has been reviewed and approved by our team.</p>
  <p>It's now live on the marketplace and influencers can start applying.</p>
  <div style="background-color: #f1f6ff; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #005EFF;">
    <p style="margin: 0; font-weight: 600; color: #005EFF;">📢 ${campaignTitle}</p>
    <p style="margin: 5px 0 0; color: #6b7280; font-size: 13px;">Status: Active — Accepting Applications</p>
  </div>
  <a href="#" class="btn">View Campaign</a>
`);

exports.paymentReceived = (name, amount, campaignTitle) => baseLayout(`
  <h2>Payment Received! 💰</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>A payment of <strong>₹${Number(amount).toLocaleString('en-IN')}</strong> has been processed for the campaign <strong>"${campaignTitle}"</strong>.</p>
  <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; border: 1px solid #bbf7d0;">
    <p style="margin: 0; color: #6b7280; font-size: 13px;">Amount Received</p>
    <p style="margin: 5px 0 0; font-size: 32px; font-weight: 800; color: #16a34a;">₹${Number(amount).toLocaleString('en-IN')}</p>
  </div>
  <p>The funds are now in your wallet. You can withdraw them anytime from your dashboard.</p>
  <a href="#" class="btn">View Wallet</a>
`);

exports.weeklyDigest = (name, stats) => baseLayout(`
  <h2>Your Weekly Digest 📊</h2>
  <p>Hi ${name.split(' ')[0]},</p>
  <p>Here's a summary of your activity this week on Connect.AI:</p>
  <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Profile Views</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111;">${stats?.profileViews || 0}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">New Messages</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111;">${stats?.newMessages || 0}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Campaign Activity</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #111;">${stats?.campaignActivity || 0}</td>
      </tr>
    </table>
  </div>
  <a href="#" class="btn">View Dashboard</a>
  <p style="margin-top: 20px; color: #9ca3af; font-size: 12px;">You can disable weekly digests in your notification settings.</p>
`);

// Map template keys to functions for admin preview
exports.TEMPLATE_MAP = {
  welcome: (name) => exports.welcome(name),
  verification: (name) => exports.verificationOTP(name, '123456'),
  passwordReset: (name) => exports.passwordReset(name, '654321'),
  campaignApproved: (name) => exports.campaignApproved(name, 'Sample Campaign'),
  paymentReceived: (name) => exports.paymentReceived(name, 25000, 'Sample Campaign'),
  weeklyDigest: (name) => exports.weeklyDigest(name, { profileViews: 142, newMessages: 8, campaignActivity: 3 }),
};

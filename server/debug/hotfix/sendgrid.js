"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendGridService = void 0;
const mail_1 = __importDefault(require("@sendgrid/mail"));

// Helper function to ensure URL has proper format
function sanitizeUrl(url) {
  if (!url) return 'https://app.ciroai.us';
  
  // Remove trailing slashes
  let sanitized = url.trim().replace(/\/+$/, '');
  
  // Ensure URL has http/https protocol
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    sanitized = 'https://' + sanitized;
  }
  
  return sanitized;
}

class SendGridService {
    testMode = false;
    constructor() {
        if (!process.env.SENDGRID_API_KEY) {
            console.warn('SendGrid API key not configured. Email functionality will be disabled.');
            this.testMode = true;
            return;
        }
        mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
    }
    async sendEmail(to, subject, html, from = process.env.FROM_EMAIL || 'noreply@ciroai.us') {
        if (this.testMode) {
            console.log('SendGrid in test mode. Email not sent.');
            console.log('To:', to);
            console.log('Subject:', subject);
            return { success: true };
        }
        try {
            const msg = {
                to,
                from,
                subject,
                html,
            };
            await mail_1.default.send(msg);
            return { success: true };
        }
        catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error };
        }
    }
    async sendPasswordResetEmail(email, token) {
        const emailContent = createPasswordResetEmail(email, token);
        return this.sendEmail(email, emailContent.subject, emailContent.html);
    }
    async sendVerificationEmail(email, token) {
        const emailContent = createEmailVerificationEmail(email, token);
        return this.sendEmail(email, emailContent.subject, emailContent.html);
    }
    async sendWelcomeEmail(email, name) {
        const emailContent = createWelcomeEmail(email, name);
        return this.sendEmail(email, emailContent.subject, emailContent.html);
    }
}
exports.SendGridService = SendGridService;

function createPasswordResetEmail(email, token) {
    // Sanitize the frontend URL
    const baseUrl = sanitizeUrl(process.env.FRONTEND_URL);
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    return {
        subject: 'Reset Your Password',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <p><a href="${resetUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Thank you,<br>The CIRO AI Team</p>
      </div>
    `
    };
}

function createEmailVerificationEmail(email, token) {
    // Sanitize the frontend URL
    const baseUrl = sanitizeUrl(process.env.FRONTEND_URL);
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    return {
        subject: 'Verify Your Email Address',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email Address</h2>
        <p>Hello,</p>
        <p>Thank you for registering with us. Please click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
        <p>Or copy and paste this URL into your browser: <a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>Thank you,<br>The CIRO AI Team</p>
      </div>
    `
    };
}

function createWelcomeEmail(email, name) {
    return {
        subject: 'Welcome to CIRO AI',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to CIRO AI!</h2>
        <p>Hello ${name || 'there'},</p>
        <p>Thank you for joining CIRO AI. We're excited to have you on board!</p>
        <p>With CIRO AI, you can:</p>
        <ul>
          <li>Connect to your data sources</li>
          <li>Chat with your data using AI</li>
          <li>Generate insights and visualizations</li>
          <li>Build custom dashboards</li>
        </ul>
        <p>If you have any questions or need assistance, feel free to reply to this email.</p>
        <p>Best regards,<br>The CIRO AI Team</p>
      </div>
    `
    };
}

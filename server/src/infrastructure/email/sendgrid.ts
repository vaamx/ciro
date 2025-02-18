import sgMail from '@sendgrid/mail';

export class SendGridService {
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email functionality will not work.');
      return;
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  private async sendEmail(to: string, subject: string, html: string) {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      console.warn('Email not sent: SendGrid configuration missing');
      return;
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  public async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your email address</h2>
        <p>Thank you for registering! Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #7c3aed; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `;

    await this.sendEmail(email, 'Verify your email address', html);
  }

  public async sendWelcomeEmail(email: string, name: string) {
    const gettingStartedUrl = `${process.env.FRONTEND_URL}/getting-started`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to our platform, ${name}!</h2>
        <p>Thank you for verifying your email address. Your account is now fully activated.</p>
        <p>You can now start using our services.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${gettingStartedUrl}" 
             style="background-color: #7c3aed; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Get Started
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p>${gettingStartedUrl}</p>
      </div>
    `;

    await this.sendEmail(email, 'Welcome to our platform!', html);
  }

  public async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #7c3aed; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await this.sendEmail(email, 'Reset your password', html);
  }
} 
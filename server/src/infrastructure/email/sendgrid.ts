import sgMail from '@sendgrid/mail';

export class SendGridService {
  private testMode: boolean = false;

  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email functionality will work in TEST MODE only.');
      this.testMode = true;
      return;
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  private async sendEmail(to: string, subject: string, html: string) {
    if (this.testMode) {
      // Log the email details for testing
      console.log('================= TEST EMAIL =================');
      console.log(`TO: ${to}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`FROM: ${process.env.SENDGRID_FROM_EMAIL || 'test@example.com'}`);
      console.log('CONTENT:');
      console.log(html);
      console.log('===============================================');
      console.log('View verification URLs in the test email above.');
      console.log(`In production, this would be sent to: ${to}`);
      console.log('===============================================');
      
      // Return success in test mode
      return true;
    }

    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      console.warn('Email not sent: SendGrid configuration missing');
      return false;
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
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  private getSanitizedFrontendUrl(): string {
    // Always use hardcoded URL regardless of environment
    console.log('Using hardcoded production URL for email links');
    return 'https://app.ciroai.us';
  }

  public async sendVerificationEmail(email: string, token: string) {
    // Get sanitized frontend URL
    const frontendUrl = this.getSanitizedFrontendUrl();
    
    // Construct a proper verification URL with the token
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    
    console.log(`Generated verification URL: ${verificationUrl}`);
    
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

    return await this.sendEmail(email, 'Verify your email address', html);
  }

  public async sendWelcomeEmail(email: string, name: string) {
    // Get sanitized frontend URL
    const frontendUrl = this.getSanitizedFrontendUrl();
    
    // Construct a proper URL
    const gettingStartedUrl = `${frontendUrl}/getting-started`;
    
    console.log(`Generated welcome URL: ${gettingStartedUrl}`);
    
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

    return await this.sendEmail(email, 'Welcome to our platform!', html);
  }

  public async sendPasswordResetEmail(email: string, token: string) {
    // Get sanitized frontend URL
    const frontendUrl = this.getSanitizedFrontendUrl();
    
    // Construct a proper URL
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    
    console.log(`Generated password reset URL: ${resetUrl}`);
    
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

    return await this.sendEmail(email, 'Reset your password', html);
  }
} 
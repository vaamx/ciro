import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL') || '';
    
    if (!apiKey) {
      this.logger.warn('SendGrid API key not configured. Email functionality will not work.');
      return;
    }
    
    sgMail.setApiKey(apiKey);
    this.logger.log('SendGridService initialized');
  }

  /**
   * Send an email with the provided details
   * @param to Recipient email address
   * @param subject Email subject
   * @param html Email content in HTML format
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.configService.get<string>('SENDGRID_API_KEY') || !this.fromEmail) {
      this.logger.warn('Email not sent: SendGrid configuration missing');
      return;
    }

    const msg = {
      to,
      from: this.fromEmail,
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.debug(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error('Error sending email', error);
      throw error;
    }
  }

  /**
   * Send a verification email to a user
   * @param email The user's email address
   * @param token The verification token
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    
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

  /**
   * Send a welcome email to a newly verified user
   * @param email The user's email address
   * @param name The user's name
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const gettingStartedUrl = `${frontendUrl}/getting-started`;
    
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

  /**
   * Send a password reset email to a user
   * @param email The user's email address
   * @param token The password reset token
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    
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
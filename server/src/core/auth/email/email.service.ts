import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Send a verification email to a user
   * @param email The user's email address
   * @param token The verification token
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    this.logger.log(`[MOCK] Sending verification email to ${email} with token ${token}`);
    // Mock implementation - in production this would actually send an email
  }

  /**
   * Send a welcome email to a newly verified user
   * @param email The user's email address
   * @param name The user's name
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    this.logger.log(`[MOCK] Sending welcome email to ${email} with name ${name}`);
    // Mock implementation - in production this would actually send an email
  }

  /**
   * Send a password reset email to a user
   * @param email The user's email address
   * @param token The password reset token
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    this.logger.log(`[MOCK] Sending password reset email to ${email} with token ${token}`);
    // Mock implementation - in production this would actually send an email
  }
} 
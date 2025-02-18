import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { SendGridService } from '../infrastructure/email/sendgrid';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';

export class AuthController {
  private db: Pool;
  private emailService: SendGridService;

  constructor(db: Pool) {
    this.db = db;
    this.emailService = new SendGridService();
  }

  private getJwtSignOptions(): SignOptions {
    return {
      expiresIn: '24h',
      algorithm: 'HS256'
    };
  }

  private getJwtSecret(): Secret {
    if (!config.jwt.secret) {
      throw new Error('JWT secret is not configured');
    }
    return config.jwt.secret;
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  public register = async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      // Check if user already exists
      const existingUser = await this.db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0];
        
        // If user exists but isn't verified, generate new verification token and send email
        if (!user.email_verified) {
          const verificationToken = this.generateVerificationToken();
          const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          await this.db.query(
            `UPDATE users 
             SET email_verification_token = $1,
                 email_verification_token_expires_at = $2
             WHERE id = $3`,
            [verificationToken, tokenExpiresAt, user.id]
          );

          try {
            await this.emailService.sendVerificationEmail(email, verificationToken);
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
          }

          return res.status(400).json({ 
            error: 'User already exists',
            message: 'A new verification email has been sent. Please check your inbox.'
          });
        }
        
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate verification token
      const verificationToken = this.generateVerificationToken();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const result = await this.db.query(
        `INSERT INTO users (
          email, password_hash, name, role, 
          email_verification_token, 
          email_verification_token_expires_at,
          email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id, email, name, role, email_verified`,
        [email, hashedPassword, name, 'user', verificationToken, tokenExpiresAt, false]
      );

      const user = result.rows[0];

      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(email, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }

      return res.status(201).json({ 
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.email_verified
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        error: 'Failed to register user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user
      const result = await this.db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if email is verified
      if (!user.email_verified) {
        return res.status(403).json({ 
          error: 'Email not verified',
          message: 'Please verify your email address before logging in'
        });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        this.getJwtSecret(),
        this.getJwtSignOptions()
      );

      // Remove sensitive data from user object
      const { password_hash, email_verification_token, email_verification_token_expires_at, ...userWithoutSensitive } = user;

      // Set token in cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Return token in response
      return res.json({ 
        token, 
        user: userWithoutSensitive,
        expiresIn: 24 * 60 * 60 // 24 hours in seconds
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Failed to login',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getCurrentUser = async (req: AuthRequest, res: Response) => {
    try {
      // Check for token in both cookie and Authorization header
      const token = req.cookies.auth_token || (req.headers.authorization?.startsWith('Bearer ') 
        ? req.headers.authorization.substring(7) 
        : null);

      if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      try {
        const decoded = jwt.verify(token, this.getJwtSecret()) as {
          id: number;
          email: string;
          role: string;
        };

        const result = await this.db.query(
          'SELECT id, email, role, created_at, updated_at FROM users WHERE id = $1',
          [decoded.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.json(result.rows[0]);
      } catch (jwtError) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    } catch (error) {
      console.error('Get current user error:', error);
      return res.status(500).json({
        error: 'Failed to get user information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public verifyEmail = async (req: Request, res: Response) => {
    try {
      const token = req.query.token;
      
      // Basic validation
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid verification token',
          message: 'The verification link is invalid. Please request a new one.'
        });
      }

      // Validate token format (64 character hex string)
      const cleanedToken = token.toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(cleanedToken)) {
        console.error('Invalid token format:', cleanedToken);
        return res.status(400).json({ 
          error: 'Invalid verification token format',
          message: 'The verification link appears to be invalid. Please request a new one.'
        });
      }

      // Find and verify user
      const result = await this.db.query(
        `UPDATE users 
         SET email_verified = true,
             email_verification_token = NULL,
             email_verification_token_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE email_verification_token = $1 
         AND email_verification_token_expires_at > CURRENT_TIMESTAMP
         AND email_verified = false
         RETURNING id, email, name, role`,
        [cleanedToken]
      );

      if (result.rows.length === 0) {
        console.error('No user found for token:', cleanedToken);
        return res.status(400).json({ 
          error: 'Invalid or expired token',
          message: 'The verification link has expired or is invalid. Please request a new verification email.'
        });
      }

      const user = result.rows[0];

      // Generate JWT for automatic login
      const authToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        this.getJwtSecret(),
        this.getJwtSignOptions()
      );

      // Send welcome email
      try {
        await this.emailService.sendWelcomeEmail(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Continue even if welcome email fails
      }

      // Set auth token in cookie
      res.cookie('auth_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return res.json({ 
        success: true,
        message: 'Your email has been successfully verified! Welcome aboard!',
        redirectUrl: '/getting-started',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      return res.status(500).json({ 
        error: 'Verification failed',
        message: 'An error occurred during verification. Please try again.'
      });
    }
  };

  public requestPasswordReset = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Generate reset token
      const resetToken = this.generateVerificationToken();
      const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      const result = await this.db.query(
        `UPDATE users 
         SET password_reset_token = $1, 
             password_reset_token_expires_at = $2
         WHERE email = $3
         RETURNING id`,
        [resetToken, tokenExpiresAt, email]
      );

      if (result.rows.length > 0) {
        // Send password reset email
        try {
          await this.emailService.sendPasswordResetEmail(email, resetToken);
        } catch (emailError) {
          console.error('Failed to send password reset email:', emailError);
          return res.status(500).json({ error: 'Failed to send password reset email' });
        }
      }

      // Always return success to prevent email enumeration
      return res.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      return res.status(500).json({
        error: 'Failed to process password reset request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public resetPassword = async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update password and clear reset token
      const result = await this.db.query(
        `UPDATE users 
         SET password_hash = $1,
             password_reset_token = NULL,
             password_reset_token_expires_at = NULL
         WHERE password_reset_token = $2
         AND password_reset_token_expires_at > NOW()
         RETURNING id`,
        [hashedPassword, token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid or expired reset token',
          message: 'Please request a new password reset link'
        });
      }

      return res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({
        error: 'Failed to reset password',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public resendVerification = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Basic validation
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ 
          error: 'Email is required',
          message: 'Please provide a valid email address.'
        });
      }

      // Clean and validate email format
      const cleanedEmail = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanedEmail)) {
        return res.status(400).json({ 
          error: 'Invalid email format',
          message: 'Please provide a valid email address.'
        });
      }

      // Find user and check if already verified
      const userResult = await this.db.query(
        'SELECT * FROM users WHERE email = $1',
        [cleanedEmail]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if user exists
        return res.status(200).json({ 
          message: 'If an account exists, a new verification email has been sent.'
        });
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        return res.status(400).json({ 
          error: 'Email already verified',
          message: 'This email address has already been verified. Please try logging in.'
        });
      }

      // Generate new verification token
      const verificationToken = this.generateVerificationToken();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new verification token
      await this.db.query(
        `UPDATE users 
         SET email_verification_token = $1,
             email_verification_token_expires_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND email_verified = false`,
        [verificationToken, tokenExpiresAt, user.id]
      );

      // Send new verification email
      try {
        await this.emailService.sendVerificationEmail(cleanedEmail, verificationToken);
        console.log('Verification email sent successfully to:', cleanedEmail);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return res.status(500).json({ 
          error: 'Email sending failed',
          message: 'Failed to send verification email. Please try again later.'
        });
      }

      return res.status(200).json({ 
        message: 'A new verification email has been sent. Please check your inbox.',
        email: cleanedEmail
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      return res.status(500).json({ 
        error: 'Verification email failed',
        message: 'An error occurred while sending the verification email. Please try again.'
      });
    }
  };
} 
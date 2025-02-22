import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config';
import { SendGridService } from '../infrastructure/email/sendgrid';
import { randomBytes } from 'crypto';
import { Knex } from 'knex';
import { db } from '../infrastructure/database';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { RequestHandler } from 'express';

export class AuthController {
  private emailService: SendGridService;
  private db: Knex;
  private jwtSecret: string;

  constructor(database: typeof db) {
    this.db = database;
    this.jwtSecret = config.jwt.secret;
    this.emailService = new SendGridService();
  }

  private getJwtSignOptions(): SignOptions {
    return {
      expiresIn: '24h',
      algorithm: 'HS256'
    };
  }

  private getJwtSecret(): Secret {
    return this.jwtSecret;
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  public register: RequestHandler = async (req, res) => {
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
      const existingUser = await this.db('users')
        .where({ email })
        .first();

      if (existingUser) {
        // If user exists but isn't verified, generate new verification token and send email
        if (!existingUser.email_verified) {
          const verificationToken = this.generateVerificationToken();
          const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          await this.db('users')
            .where({ id: existingUser.id })
            .update({
              email_verification_token: verificationToken,
              email_verification_token_expires_at: tokenExpiresAt
            });

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
      const [user] = await this.db('users')
        .insert({
          email,
          password_hash: hashedPassword,
          name,
          role: 'user',
          email_verification_token: verificationToken,
          email_verification_token_expires_at: tokenExpiresAt
        })
        .returning(['id', 'email', 'name', 'role']);

      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(email, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't expose email sending failure to client
      }

      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  };

  public login: RequestHandler = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user
      const user = await this.db('users')
        .where({ email })
        .first();

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

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

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organization_id
        },
        this.getJwtSecret(),
        this.getJwtSignOptions()
      );

      // Set cookie with proper options
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      // Set Authorization header
      res.setHeader('Authorization', `Bearer ${token}`);

      // Update last login
      await this.db('users')
        .where({ id: user.id })
        .update({ 
          last_login: this.db.fn.now(),
          updated_at: this.db.fn.now()
        });

      // Return success response with user data
      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organization_id
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ 
        error: 'An error occurred during login',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public logout: RequestHandler = async (req, res) => {
    res.clearCookie('auth_token', { path: '/' });
    res.json({ message: 'Logged out successfully' });
  };

  public getCurrentUser: RequestHandler = async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await this.db('users')
        .where({ id: req.user.id })
        .select('id', 'email', 'name', 'role', 'organization_id', 'email_verified')
        .first();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if email is verified
      if (!user.email_verified) {
        return res.status(403).json({
          error: 'Email not verified',
          message: 'Please verify your email address to continue'
        });
      }

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id
      });
    } catch (error) {
      console.error('Get current user error:', error);
      return res.status(500).json({ error: 'Failed to get user information' });
    }
  };

  public verifyEmail: RequestHandler = async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid verification token' });
      }

      // Find and verify user
      const [user] = await this.db('users')
        .where({
          email_verification_token: token,
          email_verified: false
        })
        .whereRaw('email_verification_token_expires_at > NOW()')
        .update({
          email_verified: true,
          email_verification_token: null,
          email_verification_token_expires_at: null,
          updated_at: this.db.fn.now()
        })
        .returning(['id', 'email', 'name', 'role']);

      if (!user) {
        return res.status(400).json({ 
          error: 'Invalid or expired verification token',
          message: 'Please request a new verification email'
        });
      }

      // Generate JWT for automatic login
      const authToken = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organization_id
        },
        this.getJwtSecret(),
        this.getJwtSignOptions()
      );

      // Set cookie with proper options
      res.cookie('auth_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      res.json({ 
        message: 'Email verified successfully',
        redirectUrl: '/dashboard'
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  };

  public requestPasswordReset: RequestHandler = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Generate reset token
      const resetToken = this.generateVerificationToken();
      const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      const [user] = await this.db('users')
        .where({ email })
        .update({
          password_reset_token: resetToken,
          password_reset_token_expires_at: tokenExpiresAt
        })
        .returning(['id', 'email']);

      if (user) {
        // Send password reset email
        await this.emailService.sendPasswordResetEmail(email, resetToken);
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  };

  public resetPassword: RequestHandler = async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password and clear reset token
      const [user] = await this.db('users')
        .where({
          password_reset_token: token
        })
        .whereRaw('password_reset_token_expires_at > NOW()')
        .update({
          password_hash: hashedPassword,
          password_reset_token: null,
          password_reset_token_expires_at: null,
          updated_at: this.db.fn.now()
        })
        .returning(['id']);

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  };

  public changePassword: RequestHandler = async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
      }

      // Get user with password hash
      const user = await this.db('users')
        .where({ id: req.user.id })
        .first();

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.db('users')
        .where({ id: req.user.id })
        .update({
          password_hash: hashedPassword,
          updated_at: this.db.fn.now()
        });

      return res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'Failed to change password' });
    }
  };
} 
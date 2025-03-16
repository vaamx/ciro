import { Request, Response, RequestHandler } from '../types/express-types';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../config';
import { SendGridService } from '../infrastructure/email/sendgrid';
import { randomBytes } from 'crypto';
import { Knex } from 'knex';
import { db } from '../infrastructure/database';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

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
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Check if email_verification_token column exists
      const hasVerificationTokenColumn = await this.db.schema.hasColumn('users', 'email_verification_token');
      
      // Create user with or without verification token based on schema
      let user;
      if (hasVerificationTokenColumn) {
        // Generate verification token
        const verificationToken = this.generateVerificationToken();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create user with verification token
        [user] = await this.db('users')
          .insert({
            email,
            password_hash: hashedPassword,
            name,
            role: 'user',
            email_verified: false,
            email_verification_token: verificationToken,
            email_verification_token_expires_at: tokenExpiresAt
          })
          .returning(['id', 'email', 'name', 'role']);
          
        // Send verification email with the token
        try {
          await this.emailService.sendVerificationEmail(email, verificationToken);
          console.log('Verification email sent to:', email);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't expose email sending failure to client
        }
      } else {
        // Create user without verification token
        [user] = await this.db('users')
          .insert({
            email,
            password_hash: hashedPassword,
            name,
            role: 'user',
            email_verified: false
          })
          .returning(['id', 'email', 'name', 'role']);
          
        // Send verification email with the email as the token
        try {
          // Use the email as a simple token (will be parsed in verifyEmail)
          const simpleToken = `${email}.${Date.now()}`;
          await this.emailService.sendVerificationEmail(email, simpleToken);
          console.log('Verification email sent to:', email);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't expose email sending failure to client
        }
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
      console.log('Login request received:', {
        body: req.body,
        headers: req.headers,
        cookies: req.cookies,
        path: req.path,
        originalUrl: req.originalUrl,
        url: req.url
      });

      const { email, password } = req.body;

      if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user - wrap in try/catch to detect database issues
      let user;
      try {
        console.log('Attempting to find user in database with email:', email);
        user = await this.db('users')
          .where({ email })
          .first();
        console.log('Database query completed successfully.');
      } catch (dbError) {
        console.error('Database error during user lookup:', dbError);
        return res.status(500).json({ 
          error: 'Database connection error',
          message: 'Could not connect to the database. Please try again later.'
        });
      }

      console.log('User lookup result:', {
        found: !!user,
        email: email
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      let validPassword = false;
      try {
        console.log('Verifying password...');
        validPassword = await bcrypt.compare(password, user.password_hash);
        console.log('Password verification completed.');
      } catch (bcryptError) {
        console.error('Error during password verification:', bcryptError);
        return res.status(500).json({ 
          error: 'Authentication error',
          message: 'Could not verify credentials. Please try again later.'
        });
      }

      console.log('Password verification result:', {
        valid: validPassword
      });

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if the email_verified column exists
      const hasEmailVerifiedColumn = await this.db.schema.hasColumn('users', 'email_verified');
      
      // Only check verification if the column exists and is set to false
      if (hasEmailVerifiedColumn && user.email_verified === false) {
        console.log('User email not verified:', email);
        
        // Check if email_verification_token column exists to regenerate token if needed
        const hasVerificationToken = await this.db.schema.hasColumn('users', 'email_verification_token');
        
        if (hasVerificationToken) {
          // Generate new verification token if needed
          const verificationToken = this.generateVerificationToken();
          const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          await this.db('users')
            .where({ id: user.id })
            .update({
              email_verification_token: verificationToken,
              email_verification_token_expires_at: tokenExpiresAt
            });
            
          // Resend verification email
          try {
            await this.emailService.sendVerificationEmail(email, verificationToken);
            console.log('New verification email sent to:', email);
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
          }
        } else {
          // Use simple token for verification
          const simpleToken = `${email}.${Date.now()}`;
          try {
            await this.emailService.sendVerificationEmail(email, simpleToken);
            console.log('Simple verification email sent to:', email);
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
          }
        }
        
        return res.status(403).json({ 
          error: 'Email not verified',
          message: 'Please verify your email address before logging in. A new verification email has been sent.'
        });
      }

      // Generate JWT token
      let token;
      try {
        console.log('Generating JWT token...');
        token = jwt.sign(
          { 
            id: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organization_id
          },
          this.getJwtSecret(),
          this.getJwtSignOptions()
        );
        console.log('JWT token generated successfully.');
      } catch (jwtError) {
        console.error('Error generating JWT token:', jwtError);
        return res.status(500).json({ 
          error: 'Authentication error',
          message: 'Could not create authentication token. Please try again later.'
        });
      }

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
      try {
        console.log('Updating last login timestamp...');
        await this.db('users')
          .where({ id: user.id })
          .update({ 
            last_login: this.db.fn.now(),
            updated_at: this.db.fn.now()
          });
        console.log('Last login timestamp updated successfully.');
      } catch (updateError) {
        // Don't fail the login if this update fails, just log it
        console.error('Error updating last login:', updateError);
      }

      // Return success response with user data
      console.log('Login successful, returning user data and token.');
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
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Try to determine more details about the error
      let errorMessage = 'An error occurred during login';
      let statusCode = 500;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific database errors
        if (error.message.includes('database') || error.message.includes('sql')) {
          errorMessage = 'Database error occurred, please try again later';
        }
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage,
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
        .first();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if email_verified column exists
      const hasEmailVerifiedColumn = await this.db.schema.hasColumn('users', 'email_verified');
      
      // Only check verification if the column exists and is set to false
      if (hasEmailVerifiedColumn && user.email_verified === false) {
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
      const token = req.query.token as string;

      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      // Check if this is the first time using the verify endpoint with the updated schema
      const hasEmailVerifiedColumn = await this.db.schema.hasColumn('users', 'email_verified');
      
      if (!hasEmailVerifiedColumn) {
        // If we don't have the column yet, add it
        await this.db.schema.alterTable('users', table => {
          table.boolean('email_verified').defaultTo(false);
        });
      }
      
      // Check if email_verification_token column exists
      const hasVerificationToken = await this.db.schema.hasColumn('users', 'email_verification_token');
      
      // If we don't have the verification token column yet, we'll look for the user by email in the token
      let user;
      if (!hasVerificationToken) {
        // Simple token format: we'll just take the email from the token by splitting at the first dot
        const email = token.split('.')[0];
        if (!email) {
          return res.status(400).json({ error: 'Invalid verification token format' });
        }
        
        user = await this.db('users')
          .where({ email })
          .first();
          
        if (!user) {
          return res.status(400).json({ error: 'User not found for the given verification token' });
        }
        
        // Update user to verified
        await this.db('users')
          .where({ id: user.id })
          .update({ 
            email_verified: true,
            updated_at: this.db.fn.now()
          });
      } else {
        // Standard flow with verification token column
        // Find and verify user
        user = await this.db('users')
          .where({ email_verification_token: token })
          .first();
          
        if (!user) {
          return res.status(400).json({ error: 'Invalid verification token' });
        }
        
        // Check if token is expired
        if (user.email_verification_token_expires_at && 
            new Date(user.email_verification_token_expires_at) < new Date()) {
          return res.status(400).json({ 
            error: 'Verification token has expired. Please request a new one.'
          });
        }
        
        // Update user verification status
        await this.db('users')
          .where({ id: user.id })
          .update({
            email_verified: true,
            email_verification_token: null,
            email_verification_token_expires_at: null,
            updated_at: this.db.fn.now()
          });
      }

      // Generate JWT for automatic login
      const authToken = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          role: user.role 
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
        redirectUrl: '/dashboard',
        token: authToken
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

  public resendVerification: RequestHandler = async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Find user by email
      const user = await this.db('users')
        .where({ email })
        .first();

      if (!user) {
        // Don't reveal that the user doesn't exist
        return res.json({ message: 'If an account exists with this email, a verification email has been sent.' });
      }

      // Check if user is already verified
      const hasEmailVerifiedColumn = await this.db.schema.hasColumn('users', 'email_verified');
      if (hasEmailVerifiedColumn && user.email_verified === true) {
        return res.json({ message: 'Your email is already verified. You can now log in.' });
      }

      // Check if email_verification_token column exists
      const hasVerificationToken = await this.db.schema.hasColumn('users', 'email_verification_token');
      
      if (hasVerificationToken) {
        // Generate new verification token
        const verificationToken = this.generateVerificationToken();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await this.db('users')
          .where({ id: user.id })
          .update({
            email_verification_token: verificationToken,
            email_verification_token_expires_at: tokenExpiresAt,
            updated_at: this.db.fn.now()
          });
          
        // Resend verification email
        try {
          await this.emailService.sendVerificationEmail(email, verificationToken);
          console.log('Verification email resent to:', email);
        } catch (emailError) {
          console.error('Failed to resend verification email:', emailError);
          return res.status(500).json({ error: 'Failed to send verification email' });
        }
      } else {
        // Use simple token for verification if the column doesn't exist
        const simpleToken = `${email}.${Date.now()}`;
        try {
          await this.emailService.sendVerificationEmail(email, simpleToken);
          console.log('Simple verification email resent to:', email);
        } catch (emailError) {
          console.error('Failed to resend verification email:', emailError);
          return res.status(500).json({ error: 'Failed to send verification email' });
        }
      }
      
      return res.json({ message: 'Verification email has been resent. Please check your inbox and spam folder.' });
    } catch (error) {
      console.error('Resend verification error:', error);
      return res.status(500).json({ error: 'Failed to resend verification email' });
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
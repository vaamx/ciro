import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../infrastructure/database';
import { randomBytes } from 'crypto';
import { SendGridService } from '../infrastructure/email/sendgrid';
import { config } from '../config';

const router = express.Router();
const emailService = new SendGridService();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Generate secure random string for tokens
function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const { email, password, name } = registerSchema.parse(req.body);

    console.log('Registration attempt:', { email, name });

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    ).catch(err => {
      console.error('Database error checking existing user:', err);
      throw new Error(`Database error: ${err.message}`);
    });

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    // Generate email verification token
    const verificationToken = generateSecureToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    console.log('Attempting to create user in database');

    // Create user with verification token
    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, name, role, 
        email_verification_token, 
        email_verification_token_expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, role`,
      [email, hashedPassword, name, 'user', verificationToken, tokenExpiresAt]
    ).catch(err => {
      console.error('Database error creating user:', err);
      throw new Error(`Database error: ${err.message}`);
    });

    const user = result.rows[0];
    console.log('User created successfully:', { userId: user.id });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken);

    // Return success response without creating session
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ 
      error: 'Failed to register user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const { email, password } = loginSchema.parse(req.body);

    console.log('Login attempt for email:', email);

    // Find user
    const result = await pool.query(
      'SELECT id, email, name, role, password_hash, email_verified FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    console.log('User found:', { userId: user?.id, emailVerified: user?.email_verified });

    if (!user || !user.password_hash) {
      console.log('Login failed: User not found or no password hash');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password verification result:', isValidPassword);

    if (!isValidPassword) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.email_verified) {
      console.log('Login failed: Email not verified');
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
        role: user.role
      },
      config.jwt.secret,
      { expiresIn: '24h' }
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
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    console.log('Login successful for user:', user.id);

    res.json({
      token, // Include token in response body as well
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.email_verified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    // Clear auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Clear any session data
    const token = req.cookies.auth_token || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as { id?: number };
        if (decoded.id) {
          // Update last login timestamp
          await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [decoded.id]
          );
        }
      } catch (error) {
        // Token verification failed, but we can continue with logout
        console.error('Token verification during logout failed:', error);
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, try to clear the cookie
    res.clearCookie('auth_token', { path: '/' });
    res.status(500).json({ error: 'Failed to log out' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    // Check for token in both cookie and Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = req.cookies.auth_token;
    const authToken = token || cookieToken;

    console.log('Auth check:', {
      hasAuthHeader: !!authHeader,
      hasCookieToken: !!cookieToken,
      finalToken: !!authToken
    });

    if (!authToken) {
      console.log('No auth token found');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(authToken, config.jwt.secret) as {
        id: number;
        email: string;
        role: string;
      };

      console.log('Token verified for user:', decoded.id);

      // Get user data
      const result = await pool.query(
        `SELECT id, email, name, role, email_verified 
         FROM users 
         WHERE id = $1`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        console.log('User not found:', decoded.id);
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      // Check if email is verified
      if (!user.email_verified) {
        console.log('Email not verified for user:', decoded.id);
        return res.status(403).json({ 
          error: 'Email not verified',
          message: 'Please verify your email address to continue'
        });
      }

      // Generate new token with updated expiry
      const newToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: '24h' }
      );

      console.log('Generated new token for user:', user.id);

      // Set cookie with proper options
      res.cookie('auth_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      // Set Authorization header
      res.setHeader('Authorization', `Bearer ${newToken}`);

      // Return user data with new token
      const response = {
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.email_verified
        }
      };

      console.log('Sending response:', { 
        hasToken: !!response.token, 
        hasUser: !!response.user,
        userData: response.user
      });

      return res.json(response);
    } catch (jwtError) {
      console.error('Token verification failed:', jwtError);
      res.clearCookie('auth_token', { path: '/' });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      error: 'Failed to get user information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Request password reset
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    // Generate reset token
    const resetToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Update user with reset token
    const result = await pool.query(
      `UPDATE users 
       SET password_reset_token = $1, 
           password_reset_token_expires_at = $2
       WHERE email = $3
       RETURNING id`,
      [resetToken, expiresAt, email]
    );

    if (result.rows.length > 0) {
      // Send password reset email
      await emailService.sendPasswordResetEmail(email, resetToken);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, newPassword } = z.object({
      token: z.string(),
      password: z.string().min(8).optional(),
      newPassword: z.string().min(8).optional()
    }).parse(req.body);

    // Use either password or newPassword
    const finalPassword = password || newPassword;
    if (!finalPassword) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Find user with valid reset token
    const result = await pool.query(
      `SELECT id FROM users 
       WHERE password_reset_token = $1 
       AND password_reset_token_expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = result.rows[0].id;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_token_expires_at = NULL
       WHERE id = $2`,
      [hashedPassword, userId]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Helper function to verify email token
async function verifyEmailToken(token: string, res: express.Response) {
  try {
    // Find and verify user's email
    const result = await pool.query(
      `UPDATE users 
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_token_expires_at = NULL
       WHERE email_verification_token = $1 
       AND email_verification_token_expires_at > NOW()
       RETURNING id, email, name, email_verified`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired verification token',
        message: 'Please request a new verification email'
      });
    }

    const user = result.rows[0];

    // Check if email was already verified
    if (user.email_verified) {
      return res.json({ 
        message: 'Email already verified',
        redirectUrl: '/login'
      });
    }

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.name);

    // Return success with redirect
    res.json({ 
      message: 'Email verified successfully',
      redirectUrl: '/login'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify email',
      message: 'Please try again or contact support'
    });
  }
}

// Verify email (GET endpoint for email link)
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ 
      error: 'Invalid verification token',
      message: 'Please check your verification link'
    });
  }

  await verifyEmailToken(token, res);
});

// Verify email (POST endpoint for manual verification)
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ 
      error: 'Invalid verification token',
      message: 'Please check your verification code'
    });
  }

  await verifyEmailToken(token, res);
});

export const authRouter = router; 
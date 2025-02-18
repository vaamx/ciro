import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../infrastructure/database';
import { config } from '../config';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Middleware to check if user is authenticated
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Check for token in cookie
    const cookieToken = req.cookies.auth_token;
    
    // Use either token or cookie
    const authToken = token || cookieToken;

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(authToken, config.jwt.secret) as { 
        id?: number;
        userId?: number; // Support both formats
        email?: string;
        role?: string;
      };

      // Get the actual user ID from either format
      const userId = decoded.id || decoded.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      // Check if user exists and is active
      const userResult = await pool.query(
        'SELECT id, email, role, email_verified FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Check if email is verified
      if (!user.email_verified) {
        return res.status(403).json({ 
          error: 'Email not verified',
          message: 'Please verify your email address to continue'
        });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      // Check token expiration
      const tokenExp = (decoded as any).exp;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExp = tokenExp - now;

      // If token is close to expiring (less than 5 minutes), generate a new one
      if (timeUntilExp < 300) {
        // Generate new token with updated expiry
        const newToken = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          config.jwt.secret,
          { expiresIn: '24h' }
        );

        // Set token in cookie with proper options
        res.cookie('auth_token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          path: '/'
        });

        // Set token in header
        res.setHeader('Authorization', `Bearer ${newToken}`);
      }
      
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      // Clear invalid tokens
      res.clearCookie('auth_token', { path: '/' });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check user role
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to refresh session if needed
export const refreshSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.session_token;
    
    if (!token) {
      return next();
    }

    // Check if session needs refresh (e.g., less than 1 hour remaining)
    const session = await pool.query(
      `SELECT expires_at, user_id
       FROM sessions
       WHERE session_token = $1`,
      [token]
    );

    if (session.rows.length === 0) {
      return next();
    }

    const expiresAt = new Date(session.rows[0].expires_at);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    if (expiresAt < oneHourFromNow) {
      // Generate new token
      const newToken = jwt.sign(
        { userId: session.rows[0].user_id },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '24h' }
      );

      // Update session
      await pool.query(
        `UPDATE sessions
         SET session_token = $1, expires_at = NOW() + INTERVAL '24 hours'
         WHERE session_token = $2`,
        [newToken, token]
      );

      // Set new cookie
      res.cookie('session_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }

    next();
  } catch (error) {
    console.error('Session refresh error:', error);
    next();
  }
}; 
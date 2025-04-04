import { Request, Response, NextFunction, User } from '../types';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export interface AuthRequest extends Request {
  user: User;
}

// Middleware to check if user is authenticated
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Check for token in cookie
    const cookieToken = req.cookies.auth_token;
    
    // Use either token or cookie
    const authToken = token || cookieToken;

    if (!authToken) {
      throw new UnauthorizedError('Authentication required');
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(authToken, config.jwt.secret) as {
        id: string;
        email: string;
        role: string;
        organizationId?: string;
        exp?: number;
      };

      // Check token expiration
      if (decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (now >= decoded.exp) {
          throw new UnauthorizedError('Session expired');
        }
      }

      // Check if user exists and is active
      const userResult = await db('users')
        .select('id', 'email', 'role', 'email_verified', 'organization_id')
        .where('id', decoded.id)
        .first();

      if (!userResult) {
        throw new UnauthorizedError('User not found');
      }

      // Check if email is verified
      if (!userResult.email_verified) {
        res.status(403).json({ 
          error: 'Email not verified',
          message: 'Please verify your email address to continue'
        });
        return;
      }

      // Attach user to request
      req.user = {
        id: userResult.id,
        email: userResult.email,
        role: userResult.role,
        organizationId: userResult.organization_id || decoded.organizationId || ''
      };

      next();
    } catch (tokenError) {
      // Clear invalid token
      res.clearCookie('auth_token', { path: '/' });
      throw tokenError;
    }
  } catch (error) {
    next(error);
  }
};

// Middleware to check user role
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
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
    const session = await db('sessions')
      .select('expires_at', 'user_id')
      .where('session_token', token)
      .first();

    if (!session) {
      return next();
    }

    const expiresAt = new Date(session.expires_at);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    if (expiresAt < oneHourFromNow) {
      // Generate new token
      const newToken = jwt.sign(
        { userId: session.user_id },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '24h' }
      );

      // Update session
      await db('sessions')
        .where('session_token', token)
        .update({
          session_token: newToken,
          expires_at: db.raw("NOW() + INTERVAL '24 hours'")
        });

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
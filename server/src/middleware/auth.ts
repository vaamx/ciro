import express from '../types/express-types';
import type { Request, Response, NextFunction } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import { db } from '../infrastructure/database';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';

// Define User interface
export interface User {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

// Instead of extending the global namespace, we'll use type assertions

export interface AuthRequest extends Request {
  user: User;
  params: any;
  query: any;
  body: any;
  originalUrl: string;
  organizationId?: string;
}

// Define a custom interface for the request with organizationId
interface RequestWithOrganization extends Request {
  organizationId?: string;
}

// Middleware to check if user is authenticated
export const authenticate = async (
  req: RequestWithOrganization,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Multipart request debugging
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isMultipart) {
      console.log('=== MULTIPART REQUEST DEBUG ===');
      console.log('Path:', req.path);
      console.log('Method:', req.method);
      console.log('Content-Type:', contentType);
      console.log('Authorization header present:', !!req.headers.authorization);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Cookies:', req.cookies ? JSON.stringify(req.cookies, null, 2) : 'No cookies');
      console.log('=== END MULTIPART DEBUG ===');
    }

    // Enhanced debugging in production to understand token issues
    if (isProduction) {
      console.log('=== AUTH DEBUG [PRODUCTION] ===');
      console.log('Path:', req.path);
      console.log('Method:', req.method);
      console.log('Authorization header present:', !!req.headers.authorization);
      console.log('Auth cookie present:', !!req.cookies?.auth_token);
      console.log('Query params:', req.query);
      console.log('=== END AUTH DEBUG ===');
    }

    // For testing: check if test mode is enabled
    const isTestMode = req.headers['x-test-mode'] === 'true';
    if (isTestMode && !isProduction) {
      // Use a mock user for testing
      console.log('Using test mode authentication');
      (req as AuthRequest).user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        role: 'admin',
        organizationId: '1'
      };
      return next();
    }

    // Get token from request headers
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract token from 'Bearer [token]'
      token = authHeader.substring(7);
      console.log('Token found in Authorization header');
    } else {
      console.log('No Authorization header found');
      // Check if we have a JWT in the cookies as fallback
      if (req.cookies && req.cookies.auth_token) {
        token = req.cookies.auth_token;
        console.log('Token found in cookies');
      } else {
        console.log('No token found in cookies either');
      }
    }

    if (!token) {
      console.log('No authentication token found - returning 401');
      return res.status(401).json({ 
        message: 'Authentication required',
        details: 'No valid authentication token provided' 
      });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
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
        console.log(`User not found in database: ${decoded.id}`);
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

      // Get organization ID from various sources with preference order
      // 1. Request query params (highest priority)
      // 2. User's database record 
      // 3. Token's organizationId claim
      const organizationId = 
        (req.query.organization_id as string) || 
        userResult.organization_id || 
        decoded.organizationId || 
        '';
      
      // Log organization ID source for debugging
      if (isProduction) {
        console.log('Organization ID source:', {
          fromQuery: !!req.query.organization_id,
          fromUserRecord: !!userResult.organization_id,
          fromToken: !!decoded.organizationId,
          finalValue: organizationId
        });
      }

      // Attach user to request
      (req as AuthRequest).user = {
        id: userResult.id,
        email: userResult.email,
        role: userResult.role,
        organizationId
      };

      // Also attach organizationId directly to request object for easier access
      req.organizationId = organizationId;

      console.log('JWT verification successful - user authenticated');
      next();
    } catch (verifyError) {
      console.log('JWT verification failed:', verifyError);
      return res.status(401).json({ 
        message: 'Authentication failed',
        details: 'Invalid or expired token' 
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      message: 'Internal server error during authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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

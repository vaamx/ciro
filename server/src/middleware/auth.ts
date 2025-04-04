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

// Middleware to check if user is authenticated
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Multipart request debugging
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
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

    // For testing: check if test mode is enabled
    const isTestMode = req.headers['x-test-mode'] === 'true';
    if (isTestMode && process.env.NODE_ENV !== 'production') {
      // Use a mock user for testing
      console.log('Using test mode authentication');
      req.user = {
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

/**
 * Extracts the correct organization ID to use based on the following priority:
 * 1. active_organization_id from request body (if present and valid)
 * 2. organization_id from request body (if present and valid)
 * 3. organizationId from JWT token/user object
 */
export const getRequestOrganizationId = (req: Request): number | undefined => {
  // Check req.body.active_organization_id
  if (req.body && req.body.active_organization_id) {
    const activeOrgId = parseInt(req.body.active_organization_id, 10);
    if (!isNaN(activeOrgId)) {
      console.log(`Using active_organization_id from request body: ${activeOrgId}`);
      return activeOrgId;
    }
  }
  
  // Check req.body.organization_id 
  if (req.body && req.body.organization_id) {
    const bodyOrgId = parseInt(req.body.organization_id, 10);
    if (!isNaN(bodyOrgId)) {
      console.log(`Using organization_id from request body: ${bodyOrgId}`);
      return bodyOrgId;
    }
  }
  
  // Fall back to user's organizationId from the token
  if (req.user && req.user.organizationId) {
    const userOrgId = typeof req.user.organizationId === 'string' 
      ? parseInt(req.user.organizationId, 10) 
      : req.user.organizationId;
      
    console.log(`Using organizationId from authentication token: ${userOrgId}`);
    return userOrgId;
  }
  
  return undefined;
}; 
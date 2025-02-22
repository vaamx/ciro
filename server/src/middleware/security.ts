import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Specific rate limits for sensitive endpoints
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 failed authentication attempts per hour
  message: 'Too many failed login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Speed limiter to slow down brute force attempts
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Start delaying after 50 requests
  delayMs: (hits) => hits * 100, // Add 100ms of delay for each request above delayAfter
});

// WebSocket rate limiting
export const wsRateLimiter = {
  messageLimit: 50, // messages per minute
  windowMs: 60 * 1000, // 1 minute
  userMessageCounts: new Map<number, { count: number; resetTime: number }>(),

  checkLimit(userId: number): boolean {
    const now = Date.now();
    const userCount = this.userMessageCounts.get(userId);

    if (!userCount || now > userCount.resetTime) {
      this.userMessageCounts.set(userId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (userCount.count >= this.messageLimit) {
      return false;
    }

    userCount.count++;
    return true;
  },

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [userId, data] of this.userMessageCounts.entries()) {
      if (now > data.resetTime) {
        this.userMessageCounts.delete(userId);
      }
    }
  },
};

// Start cleanup interval
setInterval(() => wsRateLimiter.cleanup(), 60 * 1000);

// Security headers middleware using helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "same-origin" },
  xssFilter: true,
});

// Request size limiter
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction) => {
  const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > MAX_CONTENT_LENGTH) {
    return res.status(413).json({ error: 'Request entity too large' });
  }
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove any potential XSS or injection attempts
        req.body[key] = req.body[key]
          .replace(/[<>]/g, '') // Remove < and >
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/data:/gi, '') // Remove data: protocol
          .trim();
      }
    }
  }
  next();
};

// SQL injection prevention middleware
export const sqlInjectionPrevention = (req: Request, res: Response, next: NextFunction) => {
  // Skip SQL injection check for specific routes
  const excludedRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/resend-verification',
    '/auth/verify-email',
    '/auth/reset-password',
    '/auth/forgot-password',
    '/api/chat/completion'  // Add chat completion endpoint to excluded routes
  ];

  // Check if the path matches any of the excluded routes
  if (excludedRoutes.some(route => req.path.endsWith(route))) {
    return next();
  }

  const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|EXEC|UNION|CREATE|TABLE|FROM|WHERE)\b.*?;)|(--.*$)|(\/\*.*?\*\/)/i;
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      // Only test actual string values, not JSON objects or arrays
      return sqlInjectionPattern.test(value);
    }
    return false;
  };

  // Only check top-level string values in body, query, and params
  const hasInjection = Object.entries(req.body).some(([key, value]) => 
    typeof value === 'string' && checkValue(value)
  ) || 
  Object.entries(req.query).some(([key, value]) => 
    typeof value === 'string' && checkValue(value)
  ) || 
  Object.entries(req.params).some(([key, value]) => 
    typeof value === 'string' && checkValue(value)
  );

  if (hasInjection) {
    console.error('SQL injection attempt detected:', {
      path: req.path,
      body: req.body,
      query: req.query,
      params: req.params
    });
    return res.status(403).json({ error: 'Potential SQL injection detected' });
  }

  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'Session expired',
      message: 'Please log in again'
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to continue'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Handle operational errors
  if (err instanceof Error && 'isOperational' in err) {
    return res.status((err as any).statusCode || 500).json({ 
      error: err.message
    });
  }

  // Default error
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    message: 'An unexpected error occurred'
  });
}; 
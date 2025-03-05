import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createLogger } from '../utils/logger';
import { authRateLimiter } from './security';

const logger = createLogger('Middleware');

// Re-export auth rate limiter
export { authRateLimiter };

// Rate limiter middleware
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      message: 'Too many requests, please try again later.',
      status: 429
    });
  }
});

// Speed limiter middleware
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 500, // allow 500 requests per windowMs without delay
  delayMs: () => 100, // use consistent 100ms delay per request after delayAfter
  maxDelayMs: 2000, // maximum delay is 2 seconds
  skipSuccessfulRequests: false
});

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

// Global error handler middleware
export const asyncErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error handling request to ${req.path}:`, { error: err });
  
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
}; 
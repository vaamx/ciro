import { Request, Response, NextFunction } from 'express-serve-static-core';

/**
 * Wraps an async Express route handler to properly catch and forward errors to Express error handlers
 * @param fn The async function to wrap
 * @returns A function that will catch any errors and pass them to the next middleware
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 
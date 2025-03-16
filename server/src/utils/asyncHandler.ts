import { Request, Response, NextFunction } from '../types/express-types';
import { AuthRequest } from '../middleware/auth';

type AsyncRequestHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Wraps an async route handler to properly handle errors
 * 
 * This utility ensures that any errors thrown in an async Express route handler
 * are properly caught and passed to the Express error handling middleware.
 * 
 * @param fn The async function to wrap
 * @returns A function that catches any errors and passes them to next()
 */
export const asyncHandler = <T extends Request = Request>(fn: (req: T, res: Response, next?: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}; 
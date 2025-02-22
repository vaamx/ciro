import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';

type AsyncRequestHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = <T extends Request = Request>(fn: AsyncRequestHandler<T>) => {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 
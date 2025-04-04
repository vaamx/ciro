declare module 'express-slow-down' {
  import { Request, Response, NextFunction } from 'express';

  interface Options {
    windowMs?: number;
    delayAfter?: number;
    delayMs?: number | ((hits: number) => number);
    maxDelayMs?: number;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    store?: any;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request, res: Response) => boolean;
    onLimitReached?: (req: Request, res: Response, options: Options) => void;
  }

  export default function slowDown(options?: Options): (req: Request, res: Response, next: NextFunction) => void;
} 
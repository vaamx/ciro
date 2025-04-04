import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import 'express';

declare namespace Express {
  interface User {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  }

  // Extend the Request interface to ensure user is always present after authentication
  interface Request {
    user?: User;
  }
}

export interface AuthenticatedRequest extends Request {
  user: Express.User;
}

export type AuthenticatedRequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<any> | any;

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
      organizationId: string;
    };
  }
}

// This export is needed to make the file a module
export {};

export interface User {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}

export interface AuthRequest extends Request {
  user: User;
}

export interface AuthenticatedResponse extends Response {
  locals: {
    user: User;
  };
} 
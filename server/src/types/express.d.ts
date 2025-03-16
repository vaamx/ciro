// This file augments the Express namespace and re-exports Express types

// Import Express types
import * as expressNamespace from 'express';

// Extend the Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
      file?: any;
    }
  }
}

// Re-export Express types to make them available when importing from 'express'
declare module 'express' {
  export type Request = expressNamespace.Request;
  export type Response = expressNamespace.Response;
  export type NextFunction = expressNamespace.NextFunction;
  export type RequestHandler = expressNamespace.RequestHandler;
  export type Router = expressNamespace.Router;
  export type Application = expressNamespace.Application;
  
  // Re-export the Router function
  export function Router(options?: expressNamespace.RouterOptions): expressNamespace.Router;
  
  // Re-export the Express function
  export default function express(): expressNamespace.Express.Application;
}

// Export Express namespace
export = expressNamespace;

/**
 * This file re-exports Express types to be used throughout the project.
 * Import from this file instead of directly from 'express' to avoid TypeScript errors.
 */

// Import Express using require to avoid esModuleInterop issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

// Define Express types
export interface Request {
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  cookies?: any;
  path?: string;
  originalUrl?: string;
  url?: string;
  user?: any;
  file?: any;
  files?: any;
  [key: string]: any;
}

export interface Response {
  status(code: number): Response;
  json(body: any): Response;
  send(body?: any): Response;
  cookie(name: string, value: string, options?: any): Response;
  clearCookie(name: string, options?: any): Response;
  setHeader(name: string, value: string): Response;
  redirect(url: string): Response;
  render(view: string, options?: any): Response;
  end(): Response;
  [key: string]: any;
}

export type NextFunction = (err?: any) => void;

export interface RequestHandler {
  (req: Request, res: Response, next: NextFunction): void;
}

export interface ErrorRequestHandler {
  (err: any, req: Request, res: Response, next: NextFunction): void;
}

export interface Router {
  use: (...handlers: any[]) => Router;
  get: (path: string, ...handlers: any[]) => Router;
  post: (path: string, ...handlers: any[]) => Router;
  put: (path: string, ...handlers: any[]) => Router;
  delete: (path: string, ...handlers: any[]) => Router;
  patch: (path: string, ...handlers: any[]) => Router;
  route: (path: string) => Router;
  [key: string]: any;
}

export interface Application extends Router {
  listen(port: number, callback?: () => void): any;
  set(setting: string, value: any): Application;
  engine(ext: string, fn: any): Application;
  [key: string]: any;
}

// Re-export Express functions
export const Router = express.Router;

// Re-export Express itself
export default express; 
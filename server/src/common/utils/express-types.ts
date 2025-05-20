import express from 'express';

export type Request = express.Request;
export type Response = express.Response;
export type NextFunction = express.NextFunction;
export type Router = express.Router;
export type RequestHandler = express.RequestHandler;

// Re-export express for convenience
export default express;

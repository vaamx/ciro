class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    isOperational = true
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 422);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 500, false);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  InternalServerError
}; 
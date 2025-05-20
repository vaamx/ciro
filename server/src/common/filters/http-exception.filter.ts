import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // Catch all exceptions if not caught by specific filters
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: exception instanceof HttpException ? exception.name : 'Error', 
      message: (typeof message === 'string') ? message : (message as any)?.message || message, // Extract message string
    };

    // Log the error
    // Log the full exception for internal server errors
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
            `HTTP Error ${status} on ${request.method} ${request.url}`,
            exception instanceof Error ? exception.stack : exception,
            AllExceptionsFilter.name // Context
        );
        // Optionally hide detailed internal errors from client in production
        if (process.env.NODE_ENV === 'production') {
            errorResponse.message = 'Internal server error';
        }
    } else {
         // Log HttpException details
        this.logger.warn(
            `HTTP Warning ${status} on ${request.method} ${request.url}: ${JSON.stringify(message)}`,
            AllExceptionsFilter.name
        );
    }

    response.status(status).json(errorResponse);
  }
} 
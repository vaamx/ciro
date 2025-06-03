import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EnhancedLoggerService } from '../services/logger.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private readonly logger: EnhancedLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent') || '';
    const ip = request.ip || request.connection.remoteAddress;
    
    // Extract user context if available
    const user = request.user;
    const userId = user?.id;
    const organizationId = user?.scopes?.organizationId;
    const clientId = user?.scopes?.clientId;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          
          // Log the API request with performance data
          this.logger.logApiRequest(method, url, statusCode, duration, {
            userId,
            organizationId,
            clientId,
            userAgent,
            ip,
          });

          // Log performance warning if request takes too long
          if (duration > 1000) { // More than 1 second
            this.logger.warn(`Slow API request detected: ${method} ${url}`, {
              duration,
              userId,
              organizationId,
              eventType: 'SLOW_REQUEST',
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;
          
          this.logger.error(`API request failed: ${method} ${url}`, error.stack, {
            duration,
            statusCode,
            userId,
            organizationId,
            clientId,
            userAgent,
            ip,
            errorName: error.name,
            errorMessage: error.message,
          });
        },
      }),
    );
  }
} 
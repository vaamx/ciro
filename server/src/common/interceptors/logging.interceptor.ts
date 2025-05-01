import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;

    this.logger.log(`Incoming Request: ${method} ${url}`);

    return next
      .handle()
      .pipe(
        tap(() => 
          this.logger.log(`Outgoing Response: ${method} ${url} - ${Date.now() - now}ms`)
        ),
      );
  }
} 
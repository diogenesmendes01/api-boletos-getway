import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const responseTime = Date.now() - now;

          const logData = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode,
            responseTime,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          };

          if (request.user) {
            logData['client'] = request.user.client;
          }

          console.log(JSON.stringify(logData));
        },
        error: (error) => {
          const response = context.switchToHttp().getResponse();
          const statusCode = error.status || 500;
          const responseTime = Date.now() - now;

          const logData = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode,
            responseTime,
            error: error.message,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          };

          console.error(JSON.stringify(logData));
        },
      }),
    );
  }
}
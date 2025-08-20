import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();
    
    // Gerar trace ID único para esta requisição
    const traceId = uuidv4();
    request.traceId = traceId;

    // Log da requisição
    this.loggerService.logRequest({
      traceId,
      method,
      url,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.connection?.remoteAddress,
      userId: request.user?.client || request.user?.id,
      body: this.sanitizeBody(request.body),
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const responseTime = Date.now() - now;

          this.loggerService.logResponse({
            traceId,
            method,
            url,
            statusCode,
            responseTime,
            userId: request.user?.client || request.user?.id,
          });

          // Log performance warning para requisições lentas
          if (responseTime > 5000) {
            this.loggerService.warn('Slow request detected', {
              traceId,
              method,
              url,
              responseTime,
              type: 'performance_warning',
            });
          }
        },
        error: (error) => {
          const statusCode = error.status || 500;
          const responseTime = Date.now() - now;

          this.loggerService.error('Request failed', error, {
            traceId,
            method,
            url,
            statusCode,
            responseTime,
            userAgent: request.headers['user-agent'],
            ip: request.ip || request.connection?.remoteAddress,
            userId: request.user?.client || request.user?.id,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    
    // Lista de campos sensíveis que não devem aparecer nos logs
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}
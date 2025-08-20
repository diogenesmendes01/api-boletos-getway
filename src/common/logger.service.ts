import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    
    const transports: winston.transport[] = [];

    // Console transport para desenvolvimento
    if (nodeEnv === 'development') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        })
      );
    }

    // File transports para produção
    if (nodeEnv === 'production') {
      // Log de aplicação geral
      transports.push(
        new DailyRotateFile({
          filename: '/app/logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );

      // Log de erros separado
      transports.push(
        new DailyRotateFile({
          filename: '/app/logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );

      // Console em produção também (para Docker logs)
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      defaultMeta: {
        service: 'api-boletos-gateway',
        environment: nodeEnv,
      },
      transports,
      exceptionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
      ],
      rejectionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
      ],
    });
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = {
      ...meta,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...(error.response && { response: error.response }),
          ...(error.status && { status: error.status }),
        },
      }),
    };
    
    this.logger.error(message, errorMeta);
  }

  // Métodos específicos para diferentes contextos
  logRequest(data: {
    traceId: string;
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
    userId?: string;
    body?: any;
  }) {
    this.info('HTTP Request', {
      type: 'http_request',
      ...data,
    });
  }

  logResponse(data: {
    traceId: string;
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
  }) {
    this.info('HTTP Response', {
      type: 'http_response',
      ...data,
    });
  }

  logDatabaseOperation(data: {
    operation: string;
    table?: string;
    duration?: number;
    success: boolean;
    error?: any;
  }) {
    const level = data.success ? 'info' : 'error';
    this.logger.log(level, 'Database Operation', {
      type: 'database_operation',
      ...data,
    });
  }

  logExternalApi(data: {
    service: string;
    method: string;
    url: string;
    statusCode?: number;
    duration?: number;
    success: boolean;
    error?: any;
    retryCount?: number;
  }) {
    const level = data.success ? 'info' : 'error';
    this.logger.log(level, 'External API Call', {
      type: 'external_api',
      ...data,
    });
  }

  logJobProcessing(data: {
    jobId: string;
    jobType: string;
    status: 'started' | 'completed' | 'failed';
    duration?: number;
    error?: any;
    metadata?: any;
  }) {
    const level = data.status === 'failed' ? 'error' : 'info';
    this.logger.log(level, 'Job Processing', {
      type: 'job_processing',
      ...data,
    });
  }

  logAuth(data: {
    action: 'login' | 'logout' | 'token_validation' | 'permission_check';
    userId?: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    reason?: string;
  }) {
    const level = data.success ? 'info' : 'warn';
    this.logger.log(level, 'Authentication', {
      type: 'authentication',
      ...data,
    });
  }

  logSecurity(data: {
    event: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    ip?: string;
    userAgent?: string;
    details?: any;
  }) {
    const level = data.severity === 'critical' || data.severity === 'high' ? 'error' : 'warn';
    this.logger.log(level, 'Security Event', {
      type: 'security',
      ...data,
    });
  }
}
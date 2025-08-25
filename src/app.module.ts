import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth/auth.module';
import { ImportsModule } from './imports/imports.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './common/logger.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { LoggerService } from './common/logger.service';
import { Import } from './entities/import.entity';
import { ImportRow } from './entities/import-row.entity';
import { Transaction } from './entities/transaction.entity';
import { Empresa } from './entities/empresa.entity';
import { Boleto } from './entities/boleto.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, LoggerModule],
      useFactory: (
        configService: ConfigService,
        loggerService: LoggerService,
      ) => {
        const isProduction = configService.get('NODE_ENV') === 'production';

        // NÃO usar URL - usar variáveis individuais que funcionam
        const config = {
          type: 'postgres' as const,
          host: configService.get('DB_HOST') || 'postgres-olympia',
          port: parseInt(configService.get('DB_PORT') || '5432'),
          username: configService.get('DB_USERNAME') || 'olympia_app',
          password:
            configService.get('DB_PASSWORD') ||
            'V/aMMGypweFPSlGivTdcaC44zzEZDfuv',
          database: configService.get('DB_DATABASE') || 'boleto_db',
          entities: [Import, ImportRow, Transaction, Empresa, Boleto],
          synchronize: false,
          logging: false,
          ssl: isProduction ? { rejectUnauthorized: false } : false, // SSL apenas em produção
        };

        loggerService.info('Database connection configured', {
          service: 'api-boletos-gateway',
          environment: isProduction ? 'production' : 'development',
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          hasPassword: !!config.password,
          type: 'database_config',
        });

        return config;
      },
      inject: [ConfigService, LoggerService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule, LoggerModule],
      useFactory: (
        configService: ConfigService,
        loggerService: LoggerService,
      ) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const redisUrl = configService.get('REDIS_URL');

        loggerService.info('Redis connection configured', {
          service: 'api-boletos-gateway',
          environment: isProduction ? 'production' : 'development',
          redisUrl: redisUrl ? 'configured' : 'not_configured',
          type: 'redis_config',
        });

        return {
          redis: redisUrl,
          defaultJobOptions: {
            removeOnComplete: isProduction ? 100 : 10, // Manter menos jobs em desenvolvimento
            removeOnFail: isProduction ? 50 : 5,
          },
        };
      },
      inject: [ConfigService, LoggerService],
    }),
    HttpModule,
    AuthModule,
    ImportsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}

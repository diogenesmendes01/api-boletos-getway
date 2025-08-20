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
      useFactory: (configService: ConfigService, loggerService: LoggerService) => {
        const config = {
          type: 'postgres' as const,
          url: configService.get('DATABASE_URL') || configService.get('POSTGRES_URL'),
          host: configService.get('DB_HOST'),
          port: parseInt(configService.get('DB_PORT') || '5432'),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_DATABASE'),
          entities: [Import, ImportRow, Transaction, Empresa, Boleto],
          synchronize: false,
          logging: process.env.NODE_ENV === 'development',
        };

        loggerService.info('Database connection configured', {
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
      useFactory: (configService: ConfigService, loggerService: LoggerService) => {
        const redisUrl = configService.get('REDIS_URL');
        
        loggerService.info('Redis connection configured', {
          redisUrl: redisUrl ? 'configured' : 'not_configured',
          type: 'redis_config',
        });

        return {
          redis: redisUrl,
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
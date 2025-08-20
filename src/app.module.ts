import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth/auth.module';
import { ImportsModule } from './imports/imports.module';
import { HealthModule } from './health/health.module';
import { LoggingInterceptor } from './common/logging.interceptor';
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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('POSTGRES_URL'),
        entities: [Import, ImportRow, Transaction, Empresa, Boleto],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get('REDIS_URL'),
      }),
      inject: [ConfigService],
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
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { Import } from '../entities/import.entity';
import { ImportRow } from '../entities/import-row.entity';
import { Transaction } from '../entities/transaction.entity';
import { ImportProcessor } from '../imports/import.processor';
import { OlympiaBankService } from '../imports/olympia-bank.service';

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
        entities: [Import, ImportRow, Transaction],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Import, ImportRow, Transaction]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'import-queue',
    }),
    HttpModule,
  ],
  providers: [ImportProcessor, OlympiaBankService],
})
export class WorkerModule {}
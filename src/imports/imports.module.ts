import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { HttpModule } from '@nestjs/axios';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { FileProcessorService } from './file-processor.service';
import { OlympiaBankService } from './olympia-bank.service';
import { ImportProcessor } from './import.processor';
import { EmpresaService } from './empresa.service';
import { BoletoService } from './boleto.service';
import { Import } from '../entities/import.entity';
import { ImportRow } from '../entities/import-row.entity';
import { Transaction } from '../entities/transaction.entity';
import { Empresa } from '../entities/empresa.entity';
import { Boleto } from '../entities/boleto.entity';
import * as multer from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [
    TypeOrmModule.forFeature([Import, ImportRow, Transaction, Empresa, Boleto]),
    BullModule.registerQueue({
      name: 'import-queue',
    }),
    MulterModule.register({
      storage: multer.diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    HttpModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService, FileProcessorService, OlympiaBankService, ImportProcessor, EmpresaService, BoletoService],
})
export class ImportsModule {}
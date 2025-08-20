import { Process, Processor, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Import, ImportStatus } from '../entities/import.entity';
import { ImportRow, RowStatus } from '../entities/import-row.entity';
import { Transaction } from '../entities/transaction.entity';
import { OlympiaBankService } from './olympia-bank.service';
import { lastValueFrom } from 'rxjs';

@Processor('import-queue')
export class ImportProcessor {
  private maxConcurrency: number;
  private maxRetries: number;

  constructor(
    @InjectRepository(Import)
    private importRepository: Repository<Import>,
    @InjectRepository(ImportRow)
    private importRowRepository: Repository<ImportRow>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private olympiaBankService: OlympiaBankService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.maxConcurrency = this.configService.get<number>('MAX_CONCURRENCY', 12);
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
  }

  @Process({ name: 'process-import', concurrency: 1 })
  async processImport(job: Job<{ importId: string }>) {
    const { importId } = job.data;
    
    await this.importRepository.update(importId, {
      status: ImportStatus.PROCESSING,
      startedAt: new Date(),
    });

    const rows = await this.importRowRepository.find({
      where: { importId, status: RowStatus.PENDING },
    });

    const batchSize = this.maxConcurrency;
    const batches = [];
    
    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push(rows.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(row => this.processRow(row)));
      
      const processedCount = await this.importRowRepository.count({
        where: { 
          importId, 
          status: RowStatus.SUCCESS,
        },
      });
      
      const errorCount = await this.importRowRepository.count({
        where: { 
          importId, 
          status: RowStatus.ERROR,
        },
      });

      await this.importRepository.update(importId, {
        processedRows: processedCount + errorCount,
        successRows: processedCount,
        errorRows: errorCount,
      });
    }

    const import_ = await this.importRepository.findOne({ where: { id: importId } });
    
    await this.importRepository.update(importId, {
      status: ImportStatus.COMPLETED,
      finishedAt: new Date(),
    });

    if (import_.webhookUrl) {
      await this.sendWebhook(import_);
    }
  }

  private async processRow(row: ImportRow) {
    let retryCount = 0;
    
    while (retryCount <= this.maxRetries) {
      try {
        await this.importRowRepository.update(row.id, {
          status: RowStatus.PROCESSING,
          retryCount,
        });

        const result = await this.olympiaBankService.createBoleto({
          amount: row.amount,
          name: row.name,
          document: row.document,
          telefone: row.telefone,
          email: row.email,
        });

        const transaction = this.transactionRepository.create({
          importRowId: row.id,
          idTransaction: result.idTransaction,
          boletoUrl: result.boletoUrl,
          boletoCode: result.boletoCode,
          pdf: result.pdf,
          dueDate: result.dueDate,
        });

        await this.transactionRepository.save(transaction);

        await this.importRowRepository.update(row.id, {
          status: RowStatus.SUCCESS,
        });

        return;
      } catch (error) {
        retryCount++;
        
        const isRetryableError = this.isRetryableError(error);
        
        if (!isRetryableError || retryCount > this.maxRetries) {
          await this.importRowRepository.update(row.id, {
            status: RowStatus.ERROR,
            errorCode: error.response?.status || 'UNKNOWN',
            errorMessage: error.message || 'Unknown error',
            retryCount,
          });
          return;
        }

        await this.delay(Math.pow(2, retryCount) * 1000);
      }
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error.response) return true;
    
    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async sendWebhook(import_: Import) {
    try {
      const stats = {
        importId: import_.id,
        status: import_.status,
        totalRows: import_.totalRows,
        successRows: import_.successRows,
        errorRows: import_.errorRows,
        startedAt: import_.startedAt,
        finishedAt: import_.finishedAt,
      };

      await lastValueFrom(
        this.httpService.post(import_.webhookUrl, stats, {
          timeout: 5000,
        })
      );
    } catch (error) {
      console.error(`Failed to send webhook for import ${import_.id}:`, error.message);
    }
  }

  @OnQueueCompleted()
  async onCompleted(job: Job) {
    console.log(`Import ${job.data.importId} completed successfully`);
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error) {
    console.error(`Import ${job.data.importId} failed:`, error.message);
    
    await this.importRepository.update(job.data.importId, {
      status: ImportStatus.FAILED,
      finishedAt: new Date(),
    });
  }
}
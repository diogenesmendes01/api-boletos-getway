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
import { LoggerService } from '../common/logger.service';
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
    private loggerService: LoggerService,
  ) {
    this.maxConcurrency = this.configService.get<number>('MAX_CONCURRENCY', 12);
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);

    this.loggerService.info('ImportProcessor initialized', {
      maxConcurrency: this.maxConcurrency,
      maxRetries: this.maxRetries,
      type: 'processor_initialization',
    });
  }

  @Process({ name: 'process-import', concurrency: 1 })
  async processImport(job: Job<{ importId: string }>) {
    const { importId } = job.data;
    const startTime = Date.now();
    
    this.loggerService.logJobProcessing({
      jobId: job.id.toString(),
      jobType: 'process-import',
      status: 'started',
      metadata: { importId },
    });

    try {
      await this.importRepository.update(importId, {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
      });

      const rows = await this.importRowRepository.find({
        where: { importId, status: RowStatus.PENDING },
      });

      this.loggerService.info('Import processing started', {
        importId,
        totalRows: rows.length,
        maxConcurrency: this.maxConcurrency,
        type: 'import_processing_start',
      });

      const batchSize = this.maxConcurrency;
      const batches = [];
      
      for (let i = 0; i < rows.length; i += batchSize) {
        batches.push(rows.slice(i, i + batchSize));
      }

      this.loggerService.debug('Import batches created', {
        importId,
        totalBatches: batches.length,
        batchSize,
        type: 'import_batch_info',
      });

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();

        this.loggerService.debug('Processing batch', {
          importId,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          batchSize: batch.length,
          type: 'batch_processing_start',
        });

        await Promise.all(batch.map(row => this.processRow(row, importId)));
        
        const batchDuration = Date.now() - batchStartTime;
        
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

        this.loggerService.info('Batch completed', {
          importId,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          processedRows: processedCount,
          errorRows: errorCount,
          batchDuration,
          type: 'batch_processing_complete',
        });
      }

      const import_ = await this.importRepository.findOne({ where: { id: importId } });
      
      await this.importRepository.update(importId, {
        status: ImportStatus.COMPLETED,
        finishedAt: new Date(),
      });

      const totalDuration = Date.now() - startTime;

      this.loggerService.logJobProcessing({
        jobId: job.id.toString(),
        jobType: 'process-import',
        status: 'completed',
        duration: totalDuration,
        metadata: {
          importId,
          totalRows: import_.totalRows,
          successRows: import_.successRows,
          errorRows: import_.errorRows,
        },
      });

      if (import_.webhookUrl) {
        await this.sendWebhook(import_);
      }
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      this.loggerService.logJobProcessing({
        jobId: job.id.toString(),
        jobType: 'process-import',
        status: 'failed',
        duration: totalDuration,
        error,
        metadata: { importId },
      });

      throw error;
    }
  }

  private async processRow(row: ImportRow, importId: string) {
    let retryCount = 0;
    
    this.loggerService.debug('Processing row started', {
      importId,
      rowId: row.id,
      rowNumber: row.rowNumber,
      amount: row.amount,
      type: 'row_processing_start',
    });
    
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

        this.loggerService.debug('Row processed successfully', {
          importId,
          rowId: row.id,
          rowNumber: row.rowNumber,
          idTransaction: result.idTransaction,
          boletoCode: result.boletoCode,
          retryCount,
          type: 'row_processing_success',
        });

        return;
      } catch (error) {
        retryCount++;
        
        const isRetryableError = this.isRetryableError(error);
        
        this.loggerService.warn('Row processing failed', {
          importId,
          rowId: row.id,
          rowNumber: row.rowNumber,
          retryCount,
          maxRetries: this.maxRetries,
          isRetryableError,
          error: error.message,
          type: 'row_processing_error',
        });
        
        if (!isRetryableError || retryCount > this.maxRetries) {
          await this.importRowRepository.update(row.id, {
            status: RowStatus.ERROR,
            errorCode: error.response?.status || 'UNKNOWN',
            errorMessage: error.message || 'Unknown error',
            retryCount,
          });

          this.loggerService.error('Row processing failed permanently', error, {
            importId,
            rowId: row.id,
            rowNumber: row.rowNumber,
            finalRetryCount: retryCount,
            errorCode: error.response?.status || 'UNKNOWN',
            type: 'row_processing_permanent_failure',
          });

          return;
        }

        const delayMs = Math.pow(2, retryCount) * 1000;
        this.loggerService.debug('Retrying row processing after delay', {
          importId,
          rowId: row.id,
          retryCount,
          delayMs,
          type: 'row_processing_retry',
        });

        await this.delay(delayMs);
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
    const startTime = Date.now();

    this.loggerService.info('Sending webhook notification', {
      importId: import_.id,
      webhookUrl: import_.webhookUrl,
      type: 'webhook_sending',
    });

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

      const response = await lastValueFrom(
        this.httpService.post(import_.webhookUrl, stats, {
          timeout: 5000,
        })
      );

      const duration = Date.now() - startTime;

      this.loggerService.logExternalApi({
        service: 'Webhook',
        method: 'POST',
        url: import_.webhookUrl,
        statusCode: response.status,
        duration,
        success: true,
      });

      this.loggerService.info('Webhook sent successfully', {
        importId: import_.id,
        webhookUrl: import_.webhookUrl,
        statusCode: response.status,
        duration,
        type: 'webhook_success',
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.loggerService.logExternalApi({
        service: 'Webhook',
        method: 'POST',
        url: import_.webhookUrl,
        statusCode: error.response?.status,
        duration,
        success: false,
        error: {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        },
      });

      this.loggerService.error('Failed to send webhook', error, {
        importId: import_.id,
        webhookUrl: import_.webhookUrl,
        duration,
        type: 'webhook_failure',
      });
    }
  }

  @OnQueueCompleted()
  async onCompleted(job: Job) {
    this.loggerService.info('Import job completed successfully', {
      jobId: job.id.toString(),
      importId: job.data.importId,
      type: 'job_completed',
    });
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error) {
    this.loggerService.error('Import job failed', error, {
      jobId: job.id.toString(),
      importId: job.data.importId,
      type: 'job_failed',
    });
    
    try {
      await this.importRepository.update(job.data.importId, {
        status: ImportStatus.FAILED,
        finishedAt: new Date(),
      });

      this.loggerService.info('Import status updated to FAILED', {
        importId: job.data.importId,
        type: 'import_status_update',
      });
    } catch (updateError) {
      this.loggerService.error('Failed to update import status to FAILED', updateError, {
        importId: job.data.importId,
        type: 'import_status_update_error',
      });
    }
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Import, ImportStatus } from '../entities/import.entity';
import { ImportRow, RowStatus } from '../entities/import-row.entity';
import { Transaction } from '../entities/transaction.entity';
import { FileProcessorService } from './file-processor.service';
import { Observable } from 'rxjs';
import * as csvStringify from 'csv-stringify/sync';

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(Import)
    private importRepository: Repository<Import>,
    @InjectRepository(ImportRow)
    private importRowRepository: Repository<ImportRow>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectQueue('import-queue')
    private importQueue: Queue,
    private fileProcessorService: FileProcessorService,
  ) {}

  async createImport(file: Express.Multer.File, webhookUrl?: string) {
    const rows = await this.fileProcessorService.parseFile(file.path);

    if (rows.length > 2000) {
      throw new Error('File contains more than 2000 rows');
    }

    const import_ = this.importRepository.create({
      ownerId: 'default',
      originalFilename: file.originalname,
      status: ImportStatus.QUEUED,
      totalRows: rows.length,
      webhookUrl,
    });

    await this.importRepository.save(import_);

    const importRows = rows.map((row, index) =>
      this.importRowRepository.create({
        importId: import_.id,
        rowNumber: index + 1,
        ...row,
        status: RowStatus.PENDING,
      }),
    );

    await this.importRowRepository.save(importRows);

    await this.importQueue.add('process-import', { importId: import_.id });

    return {
      importId: import_.id,
      status: import_.status,
    };
  }

  async getImportStatus(id: string) {
    const import_ = await this.importRepository.findOne({ where: { id } });

    if (!import_) {
      throw new NotFoundException('Import not found');
    }

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:8080';

    return {
      id: import_.id,
      status: import_.status,
      filename: import_.originalFilename,
      createdAt: import_.createdAt,
      startedAt: import_.startedAt,
      finishedAt: import_.finishedAt,
      stats: {
        total: import_.totalRows,
        processed: import_.processedRows,
        success: import_.successRows,
        error: import_.errorRows,
      },
      links: {
        results: `${baseUrl}/v1/imports/${id}/results.csv`,
        errors: `${baseUrl}/v1/imports/${id}/errors.csv`,
      },
    };
  }

  getImportEvents(id: string): Observable<MessageEvent> {
    return new Observable(observer => {
      const intervalId = setInterval(async () => {
        try {
          const import_ = await this.importRepository.findOne({
            where: { id },
          });
          if (!import_) {
            observer.error(new Error('Import not found'));
            return;
          }

          const event = {
            data: JSON.stringify({
              status: import_.status,
              progress: {
                total: import_.totalRows,
                processed: import_.processedRows,
                success: import_.successRows,
                error: import_.errorRows,
              },
            }),
          } as MessageEvent;

          observer.next(event);

          if (
            import_.status === ImportStatus.COMPLETED ||
            import_.status === ImportStatus.FAILED
          ) {
            observer.complete();
            clearInterval(intervalId);
          }
        } catch (error) {
          observer.error(error);
          clearInterval(intervalId);
        }
      }, 1000);

      return () => clearInterval(intervalId);
    });
  }

  async generateResultsCsv(importId: string) {
    const successRows = await this.importRowRepository.find({
      where: { importId, status: RowStatus.SUCCESS },
      relations: ['transaction'],
    });

    const data = successRows.map(row => ({
      row_number: row.rowNumber,
      name: row.name,
      document: row.document,
      amount: row.amount / 100,
      boleto_url: row.transaction?.boletoUrl || '',
      boleto_code: row.transaction?.boletoCode || '',
      transaction_id: row.transaction?.idTransaction || '',
    }));

    return csvStringify.stringify(data, { header: true });
  }

  async generateErrorsCsv(importId: string) {
    const errorRows = await this.importRowRepository.find({
      where: { importId, status: RowStatus.ERROR },
    });

    const data = errorRows.map(row => ({
      row_number: row.rowNumber,
      name: row.name,
      document: row.document,
      amount: row.amount / 100,
      error_code: row.errorCode,
      error_message: row.errorMessage,
    }));

    if (data.length === 0) {
      return csvStringify.stringify([], {
        header: true,
        columns: [
          'row_number',
          'name',
          'document',
          'amount',
          'error_code',
          'error_message',
        ],
      });
    }

    return csvStringify.stringify(data, { header: true });
  }
}

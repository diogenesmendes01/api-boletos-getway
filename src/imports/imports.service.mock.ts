import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class MockImportsService {
  async createImport(_file: any, _webhookUrl?: string) {
    return {
      importId: 'demo-uuid-123-456-789',
      status: 'queued',
    };
  }

  async getImportStatus(_id: string) {
    return {
      id,
      status: 'processing',
      filename: 'demo-file.csv',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
      stats: {
        total: 100,
        processed: 50,
        success: 45,
        error: 5,
      },
      links: {
        results: `https://api.exemplo.com/v1/imports/${id}/results.csv`,
        errors: `https://api.exemplo.com/v1/imports/${id}/errors.csv`,
      },
    };
  }

  getImportEvents(_id: string): Observable<MessageEvent> {
    return new Observable(observer => {
      const data = JSON.stringify({
        status: 'processing',
        progress: { total: 100, processed: 50, success: 45, error: 5 },
      });

      observer.next({ data } as MessageEvent);

      return () => {};
    });
  }

  async generateResultsCsv(_id: string): Promise<string> {
    return 'name,document,amount,boleto_url\nJoão Silva,12345678901,100.50,https://boleto.exemplo.com/123';
  }

  async generateErrorsCsv(_id: string): Promise<string> {
    return 'row_number,name,document,amount,error_code,error_message\n2,Maria Santos,invalid,200.00,INVALID_DOCUMENT,Documento inválido';
  }
}

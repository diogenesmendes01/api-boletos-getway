import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

interface CreateBoletoDto {
  amount: number;
  name: string;
  document: string;
  telefone: string;
  email: string;
}

interface BoletoResponse {
  idTransaction: string;
  boletoUrl: string;
  boletoCode: string;
  pdf: string;
  dueDate: string;
}

@Injectable()
export class OlympiaBankService {
  private baseUrl: string;
  private token: string;
  private requestQueue: Promise<any> = Promise.resolve();
  private lastRequestTime = 0;
  private minRequestInterval = 100;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('OLYMPIA_BASE_URL');
    this.token = this.configService.get<string>('OLYMPIA_TOKEN');
  }

  async createBoleto(dto: CreateBoletoDto): Promise<BoletoResponse> {
    const payload = {
      amount: dto.amount,
      client: {
        name: dto.name,
        document: dto.document,
        telefone: dto.telefone,
        email: dto.email,
      },
      utms: {
        utm_source: 'import',
        utm_medium: 'batch',
        utm_campaign: 'bulk',
      },
      product: {
        name_product: 'Boleto',
        valor_product: (dto.amount / 100).toFixed(2),
      },
      split: {
        user: 'default',
        value: '0',
      },
    };

    return this.executeWithRateLimit(async () => {
      try {
        const response = await lastValueFrom(
          this.httpService.post(`${this.baseUrl}/v1/boleto/`, payload, {
            headers: {
              Authorization: `Bearer ${this.token}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          })
        );

        return {
          idTransaction: response.data.idTransaction,
          boletoUrl: response.data.boletoUrl,
          boletoCode: response.data.boletoCode,
          pdf: response.data.pdf,
          dueDate: response.data.dueDate,
        };
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('OlympiaBank API error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          });

          if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
              this.minRequestInterval = parseInt(retryAfter) * 1000;
            }
          }

          throw new Error(
            `OlympiaBank API error: ${error.response?.data?.message || error.message}`
          );
        }
        throw error;
      }
    });
  }

  private async executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue.then(async () => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
          await this.delay(this.minRequestInterval - timeSinceLastRequest);
        }
        
        this.lastRequestTime = Date.now();
        
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
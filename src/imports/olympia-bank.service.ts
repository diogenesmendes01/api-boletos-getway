import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { LoggerService } from '../common/logger.service';

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
    private loggerService: LoggerService,
  ) {
    this.baseUrl = this.configService.get<string>('OLYMPIA_BASE_URL');
    this.token = this.configService.get<string>('OLYMPIA_TOKEN');

    this.loggerService.info('OlympiaBankService initialized', {
      baseUrl: this.baseUrl,
      hasToken: !!this.token,
      minRequestInterval: this.minRequestInterval,
      type: 'service_initialization',
    });
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
      const startTime = Date.now();

      this.loggerService.debug('Creating boleto via OlympiaBank API', {
        amount: dto.amount,
        name: dto.name,
        document: dto.document,
        type: 'boleto_creation_start',
      });

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

        const duration = Date.now() - startTime;

        this.loggerService.logExternalApi({
          service: 'OlympiaBank',
          method: 'POST',
          url: `${this.baseUrl}/v1/boleto/`,
          statusCode: response.status,
          duration,
          success: true,
        });

        this.loggerService.info('Boleto created successfully', {
          idTransaction: response.data.idTransaction,
          boletoCode: response.data.boletoCode,
          duration,
          type: 'boleto_creation_success',
        });

        return {
          idTransaction: response.data.idTransaction,
          boletoUrl: response.data.boletoUrl,
          boletoCode: response.data.boletoCode,
          pdf: response.data.pdf,
          dueDate: response.data.dueDate,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof AxiosError) {
          this.loggerService.logExternalApi({
            service: 'OlympiaBank',
            method: 'POST',
            url: `${this.baseUrl}/v1/boleto/`,
            statusCode: error.response?.status,
            duration,
            success: false,
            error: {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
            },
          });

          if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
              const newInterval = parseInt(retryAfter) * 1000;
              this.loggerService.warn('Rate limit detected, adjusting interval', {
                oldInterval: this.minRequestInterval,
                newInterval,
                retryAfter,
                type: 'rate_limit_adjustment',
              });
              this.minRequestInterval = newInterval;
            }
          }

          if (error.response?.status >= 500) {
            this.loggerService.error('OlympiaBank server error', error, {
              status: error.response?.status,
              data: error.response?.data,
              duration,
              type: 'external_api_server_error',
            });
          } else if (error.response?.status >= 400) {
            this.loggerService.warn('OlympiaBank client error', {
              status: error.response?.status,
              data: error.response?.data,
              duration,
              type: 'external_api_client_error',
            });
          }

          throw new Error(
            `OlympiaBank API error: ${error.response?.data?.message || error.message}`
          );
        }

        this.loggerService.error('Unexpected error calling OlympiaBank API', error, {
          duration,
          type: 'external_api_unexpected_error',
        });

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
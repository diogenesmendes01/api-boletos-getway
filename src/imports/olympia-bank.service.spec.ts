import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OlympiaBankService } from './olympia-bank.service';
import { LoggerService } from '../common/logger.service';
import { AxiosResponse, AxiosError } from 'axios';
import { of, throwError } from 'rxjs';

describe('OlympiaBankService', () => {
  let service: OlympiaBankService;
  let httpService: HttpService;
  // let configService: ConfigService;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggerService = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logExternalApi: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OlympiaBankService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<OlympiaBankService>(OlympiaBankService);
    httpService = module.get<HttpService>(HttpService);
    // configService = module.get<ConfigService>(ConfigService);

    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        OLYMPIA_BASE_URL: 'https://api.olympiabank.net',
        OLYMPIA_TOKEN: 'test-token',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBoleto', () => {
    const mockDto = {
      amount: 1500,
      name: 'João Silva',
      document: '11144477735',
      telefone: '5511987654321',
      email: 'joao@test.com',
    };

    const mockResponse: AxiosResponse = {
      data: {
        idTransaction: 'txn-123',
        boletoUrl: 'https://boleto.com/123',
        boletoCode: 'BOL123',
        pdf: 'base64-pdf-data',
        dueDate: '2024-12-31',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should create boleto successfully', async () => {
      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.createBoleto(mockDto);

      expect(result).toEqual({
        idTransaction: 'txn-123',
        boletoUrl: 'https://boleto.com/123',
        boletoCode: 'BOL123',
        pdf: 'base64-pdf-data',
        dueDate: '2024-12-31',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.olympiabank.net/v1/boleto/',
        {
          amount: 1500,
          client: {
            name: 'João Silva',
            document: '11144477735',
            telefone: '5511987654321',
            email: 'joao@test.com',
          },
          utms: {
            utm_source: 'import',
            utm_medium: 'batch',
            utm_campaign: 'bulk',
          },
          product: {
            name_product: 'Boleto',
            valor_product: '15.00',
          },
          split: {
            user: 'default',
            value: '0',
          },
        },
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );
    });

    it('should handle 429 rate limit error', async () => {
      const axiosError = new AxiosError('Too Many Requests');
      axiosError.response = {
        status: 429,
        data: { message: 'Rate limit exceeded' },
        headers: { 'retry-after': '60' },
      } as any;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.createBoleto(mockDto)).rejects.toThrow(
        'OlympiaBank API error: Rate limit exceeded',
      );
    });

    it('should handle 500 server error', async () => {
      const axiosError = new AxiosError('Internal Server Error');
      axiosError.response = {
        status: 500,
        data: { message: 'Internal server error' },
        headers: {},
      } as any;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.createBoleto(mockDto)).rejects.toThrow(
        'OlympiaBank API error: Internal server error',
      );
    });

    it('should handle network error', async () => {
      const networkError = new Error('Network Error');
      mockHttpService.post.mockReturnValue(throwError(() => networkError));

      await expect(service.createBoleto(mockDto)).rejects.toThrow(
        'Network Error',
      );
    });

    it('should handle axios error without response', async () => {
      const axiosError = new AxiosError('Request timeout');
      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.createBoleto(mockDto)).rejects.toThrow(
        'OlympiaBank API error: Request timeout',
      );
    });

    it('should format amount correctly', async () => {
      mockHttpService.post.mockReturnValue(of(mockResponse));

      await service.createBoleto({ ...mockDto, amount: 123456 });

      const lastCall = mockHttpService.post.mock.calls[0];
      expect(lastCall[1].product.valor_product).toBe('1234.56');
    });

    it('should handle amount with cents', async () => {
      mockHttpService.post.mockReturnValue(of(mockResponse));

      await service.createBoleto({ ...mockDto, amount: 99 });

      const lastCall = mockHttpService.post.mock.calls[0];
      expect(lastCall[1].product.valor_product).toBe('0.99');
    });
  });

  describe('rate limiting', () => {
    it('should enforce minimum request interval', async () => {
      const mockResponse: AxiosResponse = {
        data: { idTransaction: 'test' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const startTime = Date.now();

      // Primeira requisição
      await service.createBoleto({
        amount: 1000,
        name: 'Test 1',
        document: '11144477735',
        telefone: '5511987654321',
        email: 'test1@test.com',
      });

      // Segunda requisição
      await service.createBoleto({
        amount: 1000,
        name: 'Test 2',
        document: '11144477735',
        telefone: '5511987654321',
        email: 'test2@test.com',
      });

      const endTime = Date.now();

      // Deve ter levado pelo menos o intervalo mínimo entre requisições
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Considerando alguma tolerância
    });
  });
});

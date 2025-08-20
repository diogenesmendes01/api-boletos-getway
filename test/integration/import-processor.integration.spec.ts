import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ImportProcessor } from '../../src/imports/import.processor';
import { OlympiaBankService } from '../../src/imports/olympia-bank.service';
import { LoggerService } from '../../src/common/logger.service';
import { Import, ImportStatus } from '../../src/entities/import.entity';
import { ImportRow, RowStatus } from '../../src/entities/import-row.entity';
import { Transaction } from '../../src/entities/transaction.entity';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { OlympiaBankMock } from '../mocks/olympia-bank.mock';
import { of } from 'rxjs';

describe('ImportProcessor Integration', () => {
  let processor: ImportProcessor;
  let importRepository: Repository<Import>;
  let importRowRepository: Repository<ImportRow>;
  let transactionRepository: Repository<Transaction>;
  let olympiaBankService: OlympiaBankService;
  let httpService: HttpService;

  const mockImportRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockImportRowRepository = {
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

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
    logJobProcessing: jest.fn(),
    logExternalApi: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportProcessor,
        OlympiaBankService,
        {
          provide: getRepositoryToken(Import),
          useValue: mockImportRepository,
        },
        {
          provide: getRepositoryToken(ImportRow),
          useValue: mockImportRowRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
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

    processor = module.get<ImportProcessor>(ImportProcessor);
    importRepository = module.get<Repository<Import>>(getRepositoryToken(Import));
    importRowRepository = module.get<Repository<ImportRow>>(getRepositoryToken(ImportRow));
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    olympiaBankService = module.get<OlympiaBankService>(OlympiaBankService);
    httpService = module.get<HttpService>(HttpService);

    // Setup default config
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        OLYMPIA_BASE_URL: 'https://api.olympiabank.net',
        OLYMPIA_TOKEN: 'test-token',
        MAX_CONCURRENCY: 12,
        MAX_RETRIES: 5,
      };
      return config[key];
    });

    OlympiaBankMock.resetCounter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockJob = (importId: string): Job<{ importId: string }> => ({
    data: { importId },
    id: 'job-123',
    name: 'process-import',
  } as Job<{ importId: string }>);

  describe('processImport', () => {
    it('should process import with all successful rows', async () => {
      const importId = 'import-success-123';
      const mockRows = [
        {
          id: 'row-1',
          importId,
          rowNumber: 1,
          amount: 1500,
          name: 'João Silva',
          document: '11144477735',
          telefone: '5511987654321',
          email: 'joao@test.com',
          status: RowStatus.PENDING,
        },
        {
          id: 'row-2',
          importId,
          rowNumber: 2,
          amount: 2000,
          name: 'Maria Santos',
          document: '22255588844',
          telefone: '5521987654321',
          email: 'maria@test.com',
          status: RowStatus.PENDING,
        },
      ];

      const mockImport = {
        id: importId,
        webhookUrl: null,
        status: ImportStatus.QUEUED,
      };

      // Setup mocks
      mockImportRepository.update.mockResolvedValue({});
      mockImportRowRepository.find.mockResolvedValue(mockRows);
      mockImportRowRepository.count
        .mockResolvedValueOnce(2) // processedRows
        .mockResolvedValueOnce(0); // errorRows
      mockImportRepository.findOne.mockResolvedValue(mockImport);

      // Mock successful OlympiaBank responses
      mockHttpService.post.mockImplementation(() => {
        return of(OlympiaBankMock.createSuccessResponse({
          amount: 1500,
          client: {
            name: 'Test User',
            document: '11144477735',
            telefone: '5511987654321',
            email: 'test@test.com',
          },
          utms: { utm_source: 'import', utm_medium: 'batch', utm_campaign: 'bulk' },
          product: { name_product: 'Boleto', valor_product: '15.00' },
          split: { user: 'default', value: '0' },
        }));
      });

      mockTransactionRepository.create.mockImplementation((data) => ({ id: 'txn-123', ...data }));
      mockTransactionRepository.save.mockResolvedValue({});

      const job = createMockJob(importId);
      await processor.processImport(job);

      // Verify import status was updated to processing
      expect(mockImportRepository.update).toHaveBeenCalledWith(importId, {
        status: ImportStatus.PROCESSING,
        startedAt: expect.any(Date),
      });

      // Verify import was completed
      expect(mockImportRepository.update).toHaveBeenCalledWith(importId, {
        status: ImportStatus.COMPLETED,
        finishedAt: expect.any(Date),
      });

      // Verify OlympiaBank API was called for each row
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);

      // Verify transactions were created
      expect(mockTransactionRepository.create).toHaveBeenCalledTimes(2);
      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle import with some failed rows', async () => {
      const importId = 'import-mixed-123';
      const mockRows = [
        {
          id: 'row-success',
          importId,
          rowNumber: 1,
          amount: 1500,
          name: 'João Silva',
          document: '11144477735', // Will succeed
          telefone: '5511987654321',
          email: 'joao@test.com',
          status: RowStatus.PENDING,
        },
        {
          id: 'row-failure',
          importId,
          rowNumber: 2,
          amount: 2000,
          name: 'Failed User',
          document: '22222222222', // Will fail with server error
          telefone: '5521987654321',
          email: 'failed@test.com',
          status: RowStatus.PENDING,
        },
      ];

      const mockImport = {
        id: importId,
        webhookUrl: 'https://webhook.example.com',
        status: ImportStatus.QUEUED,
      };

      mockImportRepository.update.mockResolvedValue({});
      mockImportRowRepository.find.mockResolvedValue(mockRows);
      mockImportRowRepository.count
        .mockResolvedValueOnce(2) // processedRows
        .mockResolvedValueOnce(1); // errorRows
      mockImportRepository.findOne.mockResolvedValue(mockImport);

      // Mock mixed responses from OlympiaBank
      mockHttpService.post
        .mockReturnValueOnce(
          of(OlympiaBankMock.createSuccessResponse({
            amount: 1500,
            client: {
              name: 'João Silva',
              document: '11144477735',
              telefone: '5511987654321',
              email: 'joao@test.com',
            },
            utms: { utm_source: 'import', utm_medium: 'batch', utm_campaign: 'bulk' },
            product: { name_product: 'Boleto', valor_product: '15.00' },
            split: { user: 'default', value: '0' },
          }))
        )
        .mockImplementation(() => {
          throw OlympiaBankMock.createServerError(500);
        });

      // Mock webhook call
      mockHttpService.post.mockResolvedValueOnce({ data: 'ok' });

      mockTransactionRepository.create.mockImplementation((data) => ({ id: 'txn-123', ...data }));
      mockTransactionRepository.save.mockResolvedValue({});

      const job = createMockJob(importId);
      await processor.processImport(job);

      // Verify import was completed even with some failures
      expect(mockImportRepository.update).toHaveBeenCalledWith(importId, {
        status: ImportStatus.COMPLETED,
        finishedAt: expect.any(Date),
      });

      // Verify webhook was called
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://webhook.example.com',
        expect.objectContaining({
          importId,
          status: ImportStatus.COMPLETED,
          totalRows: undefined,
          successRows: 2,
          errorRows: 1,
        }),
        { timeout: 5000 }
      );
    });

    it('should handle rate limiting with retries', async () => {
      const importId = 'import-ratelimit-123';
      const mockRows = [
        {
          id: 'row-ratelimit',
          importId,
          rowNumber: 1,
          amount: 1500,
          name: 'Rate Limited User',
          document: '11111111111', // Will trigger rate limit
          telefone: '5511987654321',
          email: 'ratelimit@test.com',
          status: RowStatus.PENDING,
        },
      ];

      const mockImport = {
        id: importId,
        webhookUrl: null,
        status: ImportStatus.QUEUED,
      };

      mockImportRepository.update.mockResolvedValue({});
      mockImportRowRepository.find.mockResolvedValue(mockRows);
      mockImportRowRepository.count
        .mockResolvedValueOnce(1) // processedRows
        .mockResolvedValueOnce(1); // errorRows
      mockImportRepository.findOne.mockResolvedValue(mockImport);

      // Mock rate limit error followed by success
      mockHttpService.post
        .mockImplementationOnce(() => {
          throw OlympiaBankMock.createRateLimitError(1);
        })
        .mockReturnValueOnce(
          of(OlympiaBankMock.createSuccessResponse({
            amount: 1500,
            client: {
              name: 'Rate Limited User',
              document: '11111111111',
              telefone: '5511987654321',
              email: 'ratelimit@test.com',
            },
            utms: { utm_source: 'import', utm_medium: 'batch', utm_campaign: 'bulk' },
            product: { name_product: 'Boleto', valor_product: '15.00' },
            split: { user: 'default', value: '0' },
          }))
        );

      mockTransactionRepository.create.mockImplementation((data) => ({ id: 'txn-retry', ...data }));
      mockTransactionRepository.save.mockResolvedValue({});

      const job = createMockJob(importId);
      await processor.processImport(job);

      // Verify multiple attempts were made
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);

      // Verify final success
      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(1);
      expect(mockImportRepository.update).toHaveBeenCalledWith(importId, {
        status: ImportStatus.COMPLETED,
        finishedAt: expect.any(Date),
      });
    });

    it('should handle webhook failures gracefully', async () => {
      const importId = 'import-webhook-fail-123';
      const mockRows = [
        {
          id: 'row-webhook-test',
          importId,
          rowNumber: 1,
          amount: 1500,
          name: 'Test User',
          document: '11144477735',
          telefone: '5511987654321',
          email: 'test@test.com',
          status: RowStatus.PENDING,
        },
      ];

      const mockImport = {
        id: importId,
        webhookUrl: 'https://failed-webhook.com',
        status: ImportStatus.QUEUED,
      };

      mockImportRepository.update.mockResolvedValue({});
      mockImportRowRepository.find.mockResolvedValue(mockRows);
      mockImportRowRepository.count
        .mockResolvedValueOnce(1) // processedRows
        .mockResolvedValueOnce(0); // errorRows
      mockImportRepository.findOne.mockResolvedValue(mockImport);

      // Mock successful boleto creation
      mockHttpService.post
        .mockReturnValueOnce(
          of(OlympiaBankMock.createSuccessResponse({
            amount: 1500,
            client: {
              name: 'Test User',
              document: '11144477735',
              telefone: '5511987654321',
              email: 'test@test.com',
            },
            utms: { utm_source: 'import', utm_medium: 'batch', utm_campaign: 'bulk' },
            product: { name_product: 'Boleto', valor_product: '15.00' },
            split: { user: 'default', value: '0' },
          }))
        )
        // Mock webhook failure
        .mockRejectedValueOnce(new Error('Webhook timeout'));

      mockTransactionRepository.create.mockImplementation((data) => ({ id: 'txn-webhook', ...data }));
      mockTransactionRepository.save.mockResolvedValue({});

      const job = createMockJob(importId);
      
      // Should not throw even if webhook fails
      await expect(processor.processImport(job)).resolves.not.toThrow();

      // Verify import still completed successfully
      expect(mockImportRepository.update).toHaveBeenCalledWith(importId, {
        status: ImportStatus.COMPLETED,
        finishedAt: expect.any(Date),
      });
    });
  });
});
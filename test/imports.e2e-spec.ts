import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { Import, ImportStatus } from '../src/entities/import.entity';
import { ImportRow, RowStatus } from '../src/entities/import-row.entity';
import { Transaction } from '../src/entities/transaction.entity';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('ImportsController (e2e)', () => {
  let app: INestApplication;
  let importRepository: Repository<Import>;
  let importRowRepository: Repository<ImportRow>;
  let transactionRepository: Repository<Transaction>;
  let importQueue: Queue;
  let httpService: HttpService;

  // Mock repositories
  const mockImportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  const mockImportRowRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockTransactionRepository = {
    find: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeAll(async () => {
    // Criar arquivo CSV de teste
    const testDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const csvContent = `amount,name,document,telefone,email,vencimento
1500,João Silva,11144477735,11987654321,joao@test.com,2024-12-31
2000,Maria Santos,22255588844,21988776655,maria@test.com,31/12/2024
invalid,Invalid User,invalid-doc,invalid-phone,invalid-email,invalid-date`;

    fs.writeFileSync(path.join(testDir, 'test.csv'), csvContent);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(Import))
      .useValue(mockImportRepository)
      .overrideProvider(getRepositoryToken(ImportRow))
      .useValue(mockImportRowRepository)
      .overrideProvider(getRepositoryToken(Transaction))
      .useValue(mockTransactionRepository)
      .overrideProvider(getQueueToken('import-queue'))
      .useValue(mockQueue)
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix('v1');

    importRepository = moduleFixture.get<Repository<Import>>(getRepositoryToken(Import));
    importRowRepository = moduleFixture.get<Repository<ImportRow>>(getRepositoryToken(ImportRow));
    transactionRepository = moduleFixture.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    importQueue = moduleFixture.get<Queue>(getQueueToken('import-queue'));
    httpService = moduleFixture.get<HttpService>(HttpService);

    await app.init();
  });

  afterAll(async () => {
    // Limpar arquivos de teste
    const testDir = path.join(__dirname, 'fixtures');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }

    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/imports', () => {
    it('should create import successfully with valid CSV file', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.QUEUED,
        ownerId: 'default',
        originalFilename: 'test.csv',
        totalRows: 2,
      };

      mockImportRepository.create.mockReturnValue(mockImport);
      mockImportRepository.save.mockResolvedValue(mockImport);
      mockImportRowRepository.create.mockImplementation((data) => ({ id: 'row-id', ...data }));
      mockImportRowRepository.save.mockResolvedValue([]);
      mockQueue.add.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/v1/imports')
        .set('Authorization', 'Bearer token123')
        .attach('file', path.join(__dirname, 'fixtures', 'test.csv'))
        .expect(201);

      expect(response.body).toEqual({
        importId: 'import-123',
        status: 'queued',
        maxRows: 2000,
      });

      expect(importQueue.add).toHaveBeenCalledWith('process-import', { importId: 'import-123' });
    });

    it('should create import with webhook URL', async () => {
      const mockImport = {
        id: 'import-webhook-123',
        status: ImportStatus.QUEUED,
        ownerId: 'default',
        originalFilename: 'test.csv',
        totalRows: 2,
        webhookUrl: 'https://webhook.example.com',
      };

      mockImportRepository.create.mockReturnValue(mockImport);
      mockImportRepository.save.mockResolvedValue(mockImport);
      mockImportRowRepository.create.mockImplementation((data) => ({ id: 'row-id', ...data }));
      mockImportRowRepository.save.mockResolvedValue([]);
      mockQueue.add.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/v1/imports')
        .set('Authorization', 'Bearer token123')
        .field('webhookUrl', 'https://webhook.example.com')
        .attach('file', path.join(__dirname, 'fixtures', 'test.csv'))
        .expect(201);

      expect(response.body.importId).toBe('import-webhook-123');
      expect(importRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookUrl: 'https://webhook.example.com',
        })
      );
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/v1/imports')
        .attach('file', path.join(__dirname, 'fixtures', 'test.csv'))
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/v1/imports')
        .set('Authorization', 'Bearer invalid-token')
        .attach('file', path.join(__dirname, 'fixtures', 'test.csv'))
        .expect(401);
    });

    it('should return 400 without file', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/imports')
        .set('Authorization', 'Bearer token123')
        .expect(400);

      expect(response.body.message).toBe('File is required');
    });
  });

  describe('GET /v1/imports/:id', () => {
    it('should return import status', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.PROCESSING,
        originalFilename: 'test.csv',
        createdAt: new Date('2024-01-01'),
        startedAt: new Date('2024-01-01T10:00:00'),
        finishedAt: null,
        totalRows: 100,
        processedRows: 50,
        successRows: 45,
        errorRows: 5,
      };

      mockImportRepository.findOne.mockResolvedValue(mockImport);

      const response = await request(app.getHttpServer())
        .get('/v1/imports/import-123')
        .set('Authorization', 'Bearer token123')
        .expect(200);

      expect(response.body).toEqual({
        id: 'import-123',
        status: 'processing',
        filename: 'test.csv',
        createdAt: '2024-01-01T00:00:00.000Z',
        startedAt: '2024-01-01T10:00:00.000Z',
        finishedAt: null,
        stats: {
          total: 100,
          processed: 50,
          success: 45,
          error: 5,
        },
        links: {
          results: expect.stringContaining('/v1/imports/import-123/results.csv'),
          errors: expect.stringContaining('/v1/imports/import-123/errors.csv'),
        },
      });
    });

    it('should return 404 for non-existent import', async () => {
      mockImportRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/v1/imports/non-existent')
        .set('Authorization', 'Bearer token123')
        .expect(404);

      expect(response.body.message).toBe('Import not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/v1/imports/import-123')
        .expect(401);
    });
  });

  describe('GET /v1/imports/:id/results.csv', () => {
    it('should return results CSV', async () => {
      const mockRows = [
        {
          rowNumber: 1,
          name: 'João Silva',
          document: '11144477735',
          amount: 1500,
          transaction: {
            boletoUrl: 'https://boleto.com/1',
            boletoCode: 'BOL001',
            idTransaction: 'txn-001',
          },
        },
      ];

      mockImportRowRepository.find.mockResolvedValue(mockRows);

      const response = await request(app.getHttpServer())
        .get('/v1/imports/import-123/results.csv')
        .set('Authorization', 'Bearer token123')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('results-import-123.csv');
      expect(response.text).toContain('row_number,name,document,amount,boleto_url,boleto_code,transaction_id');
      expect(response.text).toContain('1,João Silva,11144477735,15,https://boleto.com/1,BOL001,txn-001');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/v1/imports/import-123/results.csv')
        .expect(401);
    });
  });

  describe('GET /v1/imports/:id/errors.csv', () => {
    it('should return errors CSV', async () => {
      const mockErrorRows = [
        {
          rowNumber: 1,
          name: 'Invalid User',
          document: 'invalid-doc',
          amount: 1500,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Invalid document format',
        },
      ];

      mockImportRowRepository.find.mockResolvedValue(mockErrorRows);

      const response = await request(app.getHttpServer())
        .get('/v1/imports/import-123/errors.csv')
        .set('Authorization', 'Bearer token123')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('errors-import-123.csv');
      expect(response.text).toContain('row_number,name,document,amount,error_code,error_message');
      expect(response.text).toContain('1,Invalid User,invalid-doc,15,VALIDATION_ERROR,Invalid document format');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/v1/imports/import-123/errors.csv')
        .expect(401);
    });
  });

  describe('GET /v1/imports/:id/events', () => {
    it('should establish SSE connection', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.COMPLETED,
        totalRows: 100,
        processedRows: 100,
        successRows: 95,
        errorRows: 5,
      };

      mockImportRepository.findOne.mockResolvedValue(mockImport);

      const response = await request(app.getHttpServer())
        .get('/v1/imports/import-123/events')
        .set('Authorization', 'Bearer token123')
        .set('Accept', 'text/event-stream')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/v1/imports/import-123/events')
        .expect(401);
    });
  });
});
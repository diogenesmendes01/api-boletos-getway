import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ImportsService } from './imports.service';
import { Import, ImportStatus } from '../entities/import.entity';
import { ImportRow, RowStatus } from '../entities/import-row.entity';
import { Transaction } from '../entities/transaction.entity';
import { FileProcessorService } from './file-processor.service';
import { Repository } from 'typeorm';
import { Queue } from 'bull';

describe('ImportsService', () => {
  let service: ImportsService;
  let importRepository: Repository<Import>;
  let importRowRepository: Repository<ImportRow>;
  // let transactionRepository: Repository<Transaction>;
  let importQueue: Queue;
  let fileProcessorService: FileProcessorService;

  const mockImportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
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

  const mockFileProcessorService = {
    parseFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
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
          provide: getQueueToken('import-queue'),
          useValue: mockQueue,
        },
        {
          provide: FileProcessorService,
          useValue: mockFileProcessorService,
        },
      ],
    }).compile();

    service = module.get<ImportsService>(ImportsService);
    importRepository = module.get<Repository<Import>>(
      getRepositoryToken(Import),
    );
    importRowRepository = module.get<Repository<ImportRow>>(
      getRepositoryToken(ImportRow),
    );
    // transactionRepository = module.get<Repository<Transaction>>(
    //   getRepositoryToken(Transaction),
    // );
    importQueue = module.get<Queue>(getQueueToken('import-queue'));
    fileProcessorService =
      module.get<FileProcessorService>(FileProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createImport', () => {
    const mockFile = {
      originalname: 'test.csv',
      path: '/tmp/test.csv',
    } as Express.Multer.File;

    const mockRows = [
      {
        amount: 1500,
        name: 'João Silva',
        document: '11144477735',
        telefone: '5511987654321',
        email: 'joao@test.com',
        vencimento: '2024-12-31',
      },
      {
        amount: 2000,
        name: 'Maria Santos',
        document: '22255588844',
        telefone: '5521987654321',
        email: 'maria@test.com',
        vencimento: '2024-12-31',
      },
    ];

    it('should create import successfully', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.QUEUED,
      };

      mockFileProcessorService.parseFile.mockResolvedValue(mockRows);
      mockImportRepository.create.mockReturnValue(mockImport);
      mockImportRepository.save.mockResolvedValue(mockImport);
      mockImportRowRepository.create.mockImplementation(data => ({
        id: 'row-123',
        ...data,
      }));
      mockImportRowRepository.save.mockResolvedValue([]);
      mockQueue.add.mockResolvedValue({});

      const result = await service.createImport(mockFile);

      expect(result).toEqual({
        importId: 'import-123',
        status: ImportStatus.QUEUED,
      });

      expect(fileProcessorService.parseFile).toHaveBeenCalledWith(
        '/tmp/test.csv',
      );
      expect(importRepository.create).toHaveBeenCalledWith({
        ownerId: 'default',
        originalFilename: 'test.csv',
        status: ImportStatus.QUEUED,
        totalRows: 2,
        webhookUrl: undefined,
      });
      expect(importQueue.add).toHaveBeenCalledWith('process-import', {
        importId: 'import-123',
      });
    });

    it('should create import with webhook URL', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.QUEUED,
      };

      mockFileProcessorService.parseFile.mockResolvedValue(mockRows);
      mockImportRepository.create.mockReturnValue(mockImport);
      mockImportRepository.save.mockResolvedValue(mockImport);
      mockImportRowRepository.create.mockImplementation(data => ({
        id: 'row-123',
        ...data,
      }));
      mockImportRowRepository.save.mockResolvedValue([]);
      mockQueue.add.mockResolvedValue({});

      const webhookUrl = 'https://webhook.example.com';
      await service.createImport(mockFile, webhookUrl);

      expect(importRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookUrl,
        }),
      );
    });

    it('should throw error when file has more than 2000 rows', async () => {
      const largeRowsArray = new Array(2001).fill(mockRows[0]);
      mockFileProcessorService.parseFile.mockResolvedValue(largeRowsArray);

      await expect(service.createImport(mockFile)).rejects.toThrow(
        'File contains more than 2000 rows',
      );
    });

    it('should create import rows correctly', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.QUEUED,
      };

      mockFileProcessorService.parseFile.mockResolvedValue(mockRows);
      mockImportRepository.create.mockReturnValue(mockImport);
      mockImportRepository.save.mockResolvedValue(mockImport);
      mockImportRowRepository.create.mockImplementation(data => ({
        id: 'row-123',
        ...data,
      }));
      mockImportRowRepository.save.mockResolvedValue([]);
      mockQueue.add.mockResolvedValue({});

      await service.createImport(mockFile);

      expect(importRowRepository.create).toHaveBeenCalledTimes(2);
      expect(importRowRepository.create).toHaveBeenCalledWith({
        importId: 'import-123',
        rowNumber: 1,
        ...mockRows[0],
        status: RowStatus.PENDING,
      });
      expect(importRowRepository.create).toHaveBeenCalledWith({
        importId: 'import-123',
        rowNumber: 2,
        ...mockRows[1],
        status: RowStatus.PENDING,
      });
    });
  });

  describe('getImportStatus', () => {
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

      // Mock environment variable
      process.env.API_BASE_URL = 'https://api.example.com';

      const result = await service.getImportStatus('import-123');

      expect(result).toEqual({
        id: 'import-123',
        status: ImportStatus.PROCESSING,
        filename: 'test.csv',
        createdAt: new Date('2024-01-01'),
        startedAt: new Date('2024-01-01T10:00:00'),
        finishedAt: null,
        stats: {
          total: 100,
          processed: 50,
          success: 45,
          error: 5,
        },
        links: {
          results: 'https://api.example.com/v1/imports/import-123/results.csv',
          errors: 'https://api.example.com/v1/imports/import-123/errors.csv',
        },
      });

      expect(importRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'import-123' },
      });
    });

    it('should throw NotFoundException when import not found', async () => {
      mockImportRepository.findOne.mockResolvedValue(null);

      await expect(service.getImportStatus('non-existent')).rejects.toThrow(
        'Import not found',
      );
    });

    it('should use default base URL when not configured', async () => {
      const mockImport = {
        id: 'import-123',
        status: ImportStatus.COMPLETED,
        originalFilename: 'test.csv',
        createdAt: new Date('2024-01-01'),
        startedAt: new Date('2024-01-01T10:00:00'),
        finishedAt: new Date('2024-01-01T11:00:00'),
        totalRows: 100,
        processedRows: 100,
        successRows: 95,
        errorRows: 5,
      };

      mockImportRepository.findOne.mockResolvedValue(mockImport);
      delete process.env.API_BASE_URL;

      const result = await service.getImportStatus('import-123');

      expect(result.links.results).toBe(
        'http://localhost:8080/v1/imports/import-123/results.csv',
      );
      expect(result.links.errors).toBe(
        'http://localhost:8080/v1/imports/import-123/errors.csv',
      );
    });
  });

  describe('generateResultsCsv', () => {
    it('should generate results CSV correctly', async () => {
      const mockSuccessRows = [
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
        {
          rowNumber: 2,
          name: 'Maria Santos',
          document: '22255588844',
          amount: 2000,
          transaction: {
            boletoUrl: 'https://boleto.com/2',
            boletoCode: 'BOL002',
            idTransaction: 'txn-002',
          },
        },
      ];

      mockImportRowRepository.find.mockResolvedValue(mockSuccessRows);

      const result = await service.generateResultsCsv('import-123');

      expect(result).toContain(
        'row_number,name,document,amount,boleto_url,boleto_code,transaction_id',
      );
      expect(result).toContain(
        '1,João Silva,11144477735,15,https://boleto.com/1,BOL001,txn-001',
      );
      expect(result).toContain(
        '2,Maria Santos,22255588844,20,https://boleto.com/2,BOL002,txn-002',
      );

      expect(importRowRepository.find).toHaveBeenCalledWith({
        where: { importId: 'import-123', status: RowStatus.SUCCESS },
        relations: ['transaction'],
      });
    });

    it('should handle rows without transactions', async () => {
      const mockSuccessRows = [
        {
          rowNumber: 1,
          name: 'João Silva',
          document: '11144477735',
          amount: 1500,
          transaction: null,
        },
      ];

      mockImportRowRepository.find.mockResolvedValue(mockSuccessRows);

      const result = await service.generateResultsCsv('import-123');

      expect(result).toContain('1,João Silva,11144477735,15,,,');
    });
  });

  describe('generateErrorsCsv', () => {
    it('should generate errors CSV correctly', async () => {
      const mockErrorRows = [
        {
          rowNumber: 1,
          name: 'Invalid User',
          document: 'invalid-doc',
          amount: 1500,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Invalid document format',
        },
        {
          rowNumber: 3,
          name: 'Network Error User',
          document: '33366699977',
          amount: 2500,
          errorCode: 'NETWORK_ERROR',
          errorMessage: 'Failed to connect to OlympiaBank API',
        },
      ];

      mockImportRowRepository.find.mockResolvedValue(mockErrorRows);

      const result = await service.generateErrorsCsv('import-123');

      expect(result).toContain(
        'row_number,name,document,amount,error_code,error_message',
      );
      expect(result).toContain(
        '1,Invalid User,invalid-doc,15,VALIDATION_ERROR,Invalid document format',
      );
      expect(result).toContain(
        '3,Network Error User,33366699977,25,NETWORK_ERROR,Failed to connect to OlympiaBank API',
      );

      expect(importRowRepository.find).toHaveBeenCalledWith({
        where: { importId: 'import-123', status: RowStatus.ERROR },
      });
    });

    it('should handle empty error list', async () => {
      mockImportRowRepository.find.mockResolvedValue([]);

      const result = await service.generateErrorsCsv('import-123');

      expect(result).toContain(
        'row_number,name,document,amount,error_code,error_message',
      );
    });
  });
});

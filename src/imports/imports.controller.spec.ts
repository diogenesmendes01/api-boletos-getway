import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { AuthGuard } from '../auth/auth.guard';
import { of } from 'rxjs';

describe('ImportsController', () => {
  let controller: ImportsController;
  let service: ImportsService;

  const mockImportsService = {
    createImport: jest.fn(),
    getImportStatus: jest.fn(),
    getImportEvents: jest.fn(),
    generateResultsCsv: jest.fn(),
    generateErrorsCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: mockImportsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ImportsController>(ImportsController);
    service = module.get<ImportsService>(ImportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createImport', () => {
    it('should create import successfully', async () => {
      const mockFile = {
        originalname: 'test.csv',
        path: '/tmp/test.csv',
        mimetype: 'text/csv',
        size: 1024,
      } as Express.Multer.File;

      const expectedResult = {
        importId: 'uuid-123',
        status: 'queued',
      };

      mockImportsService.createImport.mockResolvedValue(expectedResult);

      const result = await controller.createImport(mockFile, 'https://webhook.url');

      expect(result).toEqual({
        importId: 'uuid-123',
        status: 'queued',
        maxRows: 2000,
      });

      expect(service.createImport).toHaveBeenCalledWith(mockFile, 'https://webhook.url');
    });

    it('should create import without webhook URL', async () => {
      const mockFile = {
        originalname: 'test.csv',
        path: '/tmp/test.csv',
        mimetype: 'text/csv',
        size: 1024,
      } as Express.Multer.File;

      const expectedResult = {
        importId: 'uuid-456',
        status: 'queued',
      };

      mockImportsService.createImport.mockResolvedValue(expectedResult);

      const result = await controller.createImport(mockFile);

      expect(result).toEqual({
        importId: 'uuid-456',
        status: 'queued',
        maxRows: 2000,
      });

      expect(service.createImport).toHaveBeenCalledWith(mockFile, undefined);
    });

    it('should throw error when file is missing', async () => {
      await expect(controller.createImport(null, null)).rejects.toThrow(
        new HttpException('File is required', HttpStatus.BAD_REQUEST)
      );

      expect(service.createImport).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const mockFile = {
        originalname: 'large-file.csv',
        path: '/tmp/large-file.csv',
        mimetype: 'text/csv',
        size: 1024000,
      } as Express.Multer.File;

      mockImportsService.createImport.mockRejectedValue(
        new Error('File contains more than 2000 rows')
      );

      await expect(controller.createImport(mockFile)).rejects.toThrow(
        'File contains more than 2000 rows'
      );
    });
  });

  describe('getImportStatus', () => {
    it('should return import status', async () => {
      const mockStatus = {
        id: 'uuid-123',
        status: 'processing',
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
          results: 'http://api/v1/imports/uuid-123/results.csv',
          errors: 'http://api/v1/imports/uuid-123/errors.csv',
        },
      };

      mockImportsService.getImportStatus.mockResolvedValue(mockStatus);

      const result = await controller.getImportStatus('uuid-123');

      expect(result).toEqual(mockStatus);
      expect(service.getImportStatus).toHaveBeenCalledWith('uuid-123');
    });

    it('should handle invalid UUID format', async () => {
      // This would be handled by the ParseUUIDPipe in a real scenario
      // Here we're just testing the service call
      mockImportsService.getImportStatus.mockRejectedValue(
        new Error('Import not found')
      );

      await expect(controller.getImportStatus('invalid-uuid')).rejects.toThrow(
        'Import not found'
      );
    });

    it('should handle completed import', async () => {
      const mockStatus = {
        id: 'uuid-completed',
        status: 'completed',
        filename: 'completed.csv',
        createdAt: new Date('2024-01-01'),
        startedAt: new Date('2024-01-01T10:00:00'),
        finishedAt: new Date('2024-01-01T10:05:00'),
        stats: {
          total: 50,
          processed: 50,
          success: 48,
          error: 2,
        },
        links: {
          results: 'http://api/v1/imports/uuid-completed/results.csv',
          errors: 'http://api/v1/imports/uuid-completed/errors.csv',
        },
      };

      mockImportsService.getImportStatus.mockResolvedValue(mockStatus);

      const result = await controller.getImportStatus('uuid-completed');

      expect(result).toEqual(mockStatus);
      expect(result.stats.processed).toBe(result.stats.total);
    });
  });

  describe('importEvents', () => {
    it('should return observable for import events', () => {
      const mockEvents = of({
        data: JSON.stringify({
          status: 'processing',
          progress: {
            total: 100,
            processed: 25,
            success: 20,
            error: 5,
          },
        }),
      } as MessageEvent);

      mockImportsService.getImportEvents.mockReturnValue(mockEvents);

      const result = controller.importEvents('uuid-123');

      expect(result).toBe(mockEvents);
      expect(service.getImportEvents).toHaveBeenCalledWith('uuid-123');
    });
  });

  describe('getResultsCsv', () => {
    it('should return results CSV with correct headers', async () => {
      const mockCsv = 'row_number,name,document,amount,boleto_url,boleto_code,transaction_id\n1,João,111,15.00,url1,BOL1,txn1\n';
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockImportsService.generateResultsCsv.mockResolvedValue(mockCsv);

      await controller.getResultsCsv('uuid-123', mockResponse);

      expect(service.generateResultsCsv).toHaveBeenCalledWith('uuid-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="results-uuid-123.csv"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockCsv);
    });

    it('should handle empty results', async () => {
      const mockCsv = 'row_number,name,document,amount,boleto_url,boleto_code,transaction_id\n';
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockImportsService.generateResultsCsv.mockResolvedValue(mockCsv);

      await controller.getResultsCsv('uuid-empty', mockResponse);

      expect(mockResponse.send).toHaveBeenCalledWith(mockCsv);
    });

    it('should handle service errors', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockImportsService.generateResultsCsv.mockRejectedValue(
        new Error('Import not found')
      );

      await expect(
        controller.getResultsCsv('non-existent', mockResponse)
      ).rejects.toThrow('Import not found');

      expect(mockResponse.send).not.toHaveBeenCalled();
    });
  });

  describe('getErrorsCsv', () => {
    it('should return errors CSV with correct headers', async () => {
      const mockCsv = 'row_number,name,document,amount,error_code,error_message\n1,Invalid,invalid,15.00,VALIDATION,Invalid document\n';
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockImportsService.generateErrorsCsv.mockResolvedValue(mockCsv);

      await controller.getErrorsCsv('uuid-123', mockResponse);

      expect(service.generateErrorsCsv).toHaveBeenCalledWith('uuid-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="errors-uuid-123.csv"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockCsv);
    });

    it('should handle empty errors', async () => {
      const mockCsv = 'row_number,name,document,amount,error_code,error_message\n';
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockImportsService.generateErrorsCsv.mockResolvedValue(mockCsv);

      await controller.getErrorsCsv('uuid-success', mockResponse);

      expect(mockResponse.send).toHaveBeenCalledWith(mockCsv);
    });

    it('should handle service errors', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockImportsService.generateErrorsCsv.mockRejectedValue(
        new Error('Import not found')
      );

      await expect(
        controller.getErrorsCsv('non-existent', mockResponse)
      ).rejects.toThrow('Import not found');

      expect(mockResponse.send).not.toHaveBeenCalled();
    });
  });
});
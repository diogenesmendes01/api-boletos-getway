import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { Connection } from 'typeorm';

describe('HealthController', () => {
  let controller: HealthController;
  let connection: Connection;

  const mockConnection = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    connection = module.get<Connection>(getConnectionToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status when database is accessible', async () => {
      mockConnection.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.services.database).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(connection.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return degraded status when database is not accessible', async () => {
      mockConnection.query.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.services.database).toBe('unhealthy');
      expect(result.services.redis).toBe('unknown');
      expect(result.timestamp).toBeDefined();
    });

    it('should include timestamp in ISO format', async () => {
      mockConnection.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('liveness', () => {
    it('should return ok status', () => {
      const result = controller.liveness();

      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('readiness', () => {
    it('should return ready status when database is accessible', async () => {
      mockConnection.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.readiness();

      expect(result).toEqual({ status: 'ready' });
      expect(connection.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should throw error when database is not accessible', async () => {
      mockConnection.query.mockRejectedValue(new Error('Connection failed'));

      await expect(controller.readiness()).rejects.toThrow('Service not ready');
      expect(connection.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should handle different database errors', async () => {
      mockConnection.query.mockRejectedValue(new Error('Timeout'));

      await expect(controller.readiness()).rejects.toThrow('Service not ready');
    });
  });
});
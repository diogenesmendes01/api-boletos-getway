import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
// import { Connection } from 'typeorm';

describe('HealthController (e2e)', () => {
  let app: INestApplication;
  // let connection: Connection;

  const mockConnection = {
    query: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(mockConnection)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');

    // connection = moduleFixture.get<Connection>(getConnectionToken());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/health', () => {
    it('should return healthy status when all services are up', async () => {
      mockConnection.query.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        services: {
          database: 'healthy',
          redis: 'unknown',
        },
      });

      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should return degraded status when database is down', async () => {
      mockConnection.query.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'degraded',
        timestamp: expect.any(String),
        services: {
          database: 'unhealthy',
          redis: 'unknown',
        },
      });
    });

    it('should handle database timeout', async () => {
      mockConnection.query.mockRejectedValue(new Error('Query timeout'));

      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database).toBe('unhealthy');
    });
  });

  describe('GET /v1/health/liveness', () => {
    it('should return ok status for liveness probe', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health/liveness')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
      });
    });

    it('should always return ok regardless of dependencies', async () => {
      // Simular falha no banco
      mockConnection.query.mockRejectedValue(new Error('Database down'));

      const response = await request(app.getHttpServer())
        .get('/v1/health/liveness')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('GET /v1/health/readiness', () => {
    it('should return ready status when database is accessible', async () => {
      mockConnection.query.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app.getHttpServer())
        .get('/v1/health/readiness')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ready',
      });
    });

    it('should return 500 when database is not accessible', async () => {
      mockConnection.query.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app.getHttpServer())
        .get('/v1/health/readiness')
        .expect(500);

      expect(response.body.message).toBe('Service not ready');
    });

    it('should handle different database errors consistently', async () => {
      const errors = [
        'Connection timeout',
        'Authentication failed',
        'Host not found',
        'Too many connections',
      ];

      for (const errorMessage of errors) {
        mockConnection.query.mockRejectedValue(new Error(errorMessage));

        const response = await request(app.getHttpServer())
          .get('/v1/health/readiness')
          .expect(500);

        expect(response.body.message).toBe('Service not ready');
      }
    });
  });
});

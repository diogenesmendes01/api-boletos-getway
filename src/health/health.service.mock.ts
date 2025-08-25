import { Injectable } from '@nestjs/common';

@Injectable()
export class MockHealthService {
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
      },
    };
  }

  liveness() {
    return { status: 'ok' };
  }

  async readiness() {
    return { status: 'ready' };
  }
}

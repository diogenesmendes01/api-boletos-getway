import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckResponseDto, LivenessResponseDto, ReadinessResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection()
    private connection: Connection,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check completo',
    description: 'Verifica o status geral da aplicação e dos serviços dependentes (banco de dados, Redis).',
  })
  @ApiResponse({
    status: 200,
    description: 'Status da aplicação retornado com sucesso',
    type: HealthCheckResponseDto,
  })
  async check() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
    };

    try {
      await this.connection.query('SELECT 1');
      checks.services.database = 'healthy';
    } catch (error) {
      checks.services.database = 'unhealthy';
      checks.status = 'degraded';
    }

    return checks;
  }

  @Get('liveness')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Verifica se a aplicação está rodando. Usado por orchestradores como Kubernetes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Aplicação está rodando',
    type: LivenessResponseDto,
  })
  liveness() {
    return { status: 'ok' };
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Verifica se a aplicação está pronta para receber tráfego. Testa conectividade com banco de dados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Aplicação está pronta para receber requisições',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Aplicação não está pronta (erro de conectividade com banco)',
  })
  async readiness() {
    try {
      await this.connection.query('SELECT 1');
      return { status: 'ready' };
    } catch (error) {
      throw new Error('Service not ready');
    }
  }
}
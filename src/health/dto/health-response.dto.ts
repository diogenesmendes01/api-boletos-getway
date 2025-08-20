import { ApiProperty } from '@nestjs/swagger';

export class ServiceStatusDto {
  @ApiProperty({
    description: 'Status do banco de dados',
    example: 'healthy',
    enum: ['healthy', 'unhealthy', 'unknown'],
  })
  database: string;

  @ApiProperty({
    description: 'Status do Redis',
    example: 'unknown',
    enum: ['healthy', 'unhealthy', 'unknown'],
  })
  redis: string;
}

export class HealthCheckResponseDto {
  @ApiProperty({
    description: 'Status geral da aplicação',
    example: 'ok',
    enum: ['ok', 'degraded', 'unhealthy'],
  })
  status: string;

  @ApiProperty({
    description: 'Timestamp da verificação',
    example: '2024-01-01T10:00:00.000Z',
    format: 'date-time',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Status dos serviços individuais',
    type: ServiceStatusDto,
  })
  services: ServiceStatusDto;
}

export class LivenessResponseDto {
  @ApiProperty({
    description: 'Status de liveness',
    example: 'ok',
    enum: ['ok'],
  })
  status: string;
}

export class ReadinessResponseDto {
  @ApiProperty({
    description: 'Status de readiness',
    example: 'ready',
    enum: ['ready'],
  })
  status: string;
}
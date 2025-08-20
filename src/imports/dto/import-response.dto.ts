import { ApiProperty } from '@nestjs/swagger';

export class CreateImportResponseDto {
  @ApiProperty({
    description: 'ID único da importação',
    example: 'uuid-123-456-789',
    format: 'uuid',
  })
  importId: string;

  @ApiProperty({
    description: 'Status inicial da importação',
    example: 'queued',
    enum: ['queued'],
  })
  status: string;

  @ApiProperty({
    description: 'Número máximo de linhas permitidas por arquivo',
    example: 2000,
  })
  maxRows: number;
}

export class ImportStatsDto {
  @ApiProperty({
    description: 'Total de linhas no arquivo',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Número de linhas processadas',
    example: 50,
  })
  processed: number;

  @ApiProperty({
    description: 'Número de linhas processadas com sucesso',
    example: 45,
  })
  success: number;

  @ApiProperty({
    description: 'Número de linhas com erro',
    example: 5,
  })
  error: number;

  @ApiProperty({
    description: 'Número de empresas únicas processadas',
    example: 35,
  })
  empresas: number;

  @ApiProperty({
    description: 'Número de boletos gerados com sucesso',
    example: 42,
  })
  boletosGerados: number;

  @ApiProperty({
    description: 'Número de boletos com erro na geração',
    example: 3,
  })
  boletosComErro: number;
}

export class ImportLinksDto {
  @ApiProperty({
    description: 'URL para download do CSV com resultados de sucesso',
    example: 'https://api.exemplo.com/v1/imports/uuid-123/results.csv',
  })
  results: string;

  @ApiProperty({
    description: 'URL para download do CSV com erros',
    example: 'https://api.exemplo.com/v1/imports/uuid-123/errors.csv',
  })
  errors: string;
}

export class ImportStatusResponseDto {
  @ApiProperty({
    description: 'ID único da importação',
    example: 'uuid-123-456-789',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Status atual da importação',
    example: 'processing',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  status: string;

  @ApiProperty({
    description: 'Nome do arquivo original',
    example: 'boletos.csv',
  })
  filename: string;

  @ApiProperty({
    description: 'Data de criação da importação',
    example: '2024-01-01T10:00:00.000Z',
    format: 'date-time',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Data de início do processamento',
    example: '2024-01-01T10:05:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  startedAt: string | null;

  @ApiProperty({
    description: 'Data de conclusão do processamento',
    example: '2024-01-01T10:10:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  finishedAt: string | null;

  @ApiProperty({
    description: 'Estatísticas do processamento',
    type: ImportStatsDto,
  })
  stats: ImportStatsDto;

  @ApiProperty({
    description: 'Links para download dos relatórios',
    type: ImportLinksDto,
  })
  links: ImportLinksDto;
}

export class ImportEventDto {
  @ApiProperty({
    description: 'Dados do evento em formato JSON',
    example: '{"status":"processing","progress":{"total":100,"processed":50,"success":45,"error":5}}',
  })
  data: string;
}
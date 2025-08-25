import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código de status HTTP',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Mensagem de erro',
    example: 'File is required',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp do erro',
    example: '2024-01-01T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Path do endpoint',
    example: '/v1/imports',
  })
  path: string;
}

export class UnauthorizedResponseDto {
  @ApiProperty({
    description: 'Código de status HTTP',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Mensagem de erro de autorização',
    example: 'Invalid API key',
  })
  message: string;

  @ApiProperty({
    description: 'Tipo do erro',
    example: 'Unauthorized',
  })
  error: string;
}

export class NotFoundResponseDto {
  @ApiProperty({
    description: 'Código de status HTTP',
    example: 404,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Mensagem de erro',
    example: 'Import not found',
  })
  message: string;

  @ApiProperty({
    description: 'Tipo do erro',
    example: 'Not Found',
  })
  error: string;
}

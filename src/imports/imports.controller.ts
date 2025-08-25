import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  Sse,
  HttpException,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiConsumes,
  ApiParam,
  ApiProduces,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ImportsService } from './imports.service';
import { Observable } from 'rxjs';
import { CreateImportDto } from './dto/create-import.dto';
import {
  CreateImportResponseDto,
  ImportStatusResponseDto,
  ImportEventDto,
} from './dto/import-response.dto';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
  NotFoundResponseDto,
} from './dto/error-response.dto';

@ApiTags('imports')
@Controller('imports')
@UseGuards(AuthGuard)
@ApiSecurity('bearer-key')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload de arquivo para importação',
    description:
      'Faz upload de um arquivo CSV ou XLSX para processamento assíncrono de boletos. O arquivo deve conter as colunas: nome, CNPJ, endereco, numero, bairro, estado, CEP, valor, vencimento.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateImportDto })
  @ApiResponse({
    status: 201,
    description: 'Importação criada com sucesso',
    type: CreateImportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Erro na validação dos dados ou arquivo inválido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autorização inválido ou ausente',
    type: UnauthorizedResponseDto,
  })
  async createImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('webhookUrl') webhookUrl?: string,
  ) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.importsService.createImport(file, webhookUrl);
    return {
      importId: result.importId,
      status: result.status,
      maxRows: 2000,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar status da importação',
    description:
      'Retorna o status atual da importação, incluindo estatísticas de processamento e links para download dos relatórios.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único da importação',
    format: 'uuid',
    example: 'uuid-123-456-789',
  })
  @ApiResponse({
    status: 200,
    description: 'Status da importação retornado com sucesso',
    type: ImportStatusResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autorização inválido ou ausente',
    type: UnauthorizedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Importação não encontrada',
    type: NotFoundResponseDto,
  })
  async getImportStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.importsService.getImportStatus(id);
  }

  @Sse(':id/events')
  @ApiOperation({
    summary: 'Stream de eventos em tempo real',
    description:
      'Estabelece uma conexão Server-Sent Events para receber atualizações em tempo real do progresso da importação.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único da importação',
    format: 'uuid',
    example: 'uuid-123-456-789',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description: 'Stream de eventos estabelecido com sucesso',
    type: ImportEventDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autorização inválido ou ausente',
    type: UnauthorizedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Importação não encontrada',
    type: NotFoundResponseDto,
  })
  importEvents(
    @Param('id', ParseUUIDPipe) id: string,
  ): Observable<MessageEvent> {
    return this.importsService.getImportEvents(id);
  }

  @Get(':id/results.csv')
  @ApiOperation({
    summary: 'Download do CSV de sucessos',
    description:
      'Faz download de um arquivo CSV contendo todas as linhas processadas com sucesso, incluindo URLs dos boletos gerados.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único da importação',
    format: 'uuid',
    example: 'uuid-123-456-789',
  })
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'Arquivo CSV de sucessos gerado com sucesso',
    headers: {
      'Content-Type': {
        description: 'Tipo do conteúdo',
        schema: { type: 'string', example: 'text/csv' },
      },
      'Content-Disposition': {
        description: 'Disposição do conteúdo para download',
        schema: {
          type: 'string',
          example: 'attachment; filename="results-uuid.csv"',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autorização inválido ou ausente',
    type: UnauthorizedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Importação não encontrada',
    type: NotFoundResponseDto,
  })
  async getResultsCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.importsService.generateResultsCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="results-${id}.csv"`,
    );
    res.send(csv);
  }

  @Get(':id/errors.csv')
  @ApiOperation({
    summary: 'Download do CSV de erros',
    description:
      'Faz download de um arquivo CSV contendo todas as linhas que falharam no processamento, incluindo códigos e mensagens de erro.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único da importação',
    format: 'uuid',
    example: 'uuid-123-456-789',
  })
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'Arquivo CSV de erros gerado com sucesso',
    headers: {
      'Content-Type': {
        description: 'Tipo do conteúdo',
        schema: { type: 'string', example: 'text/csv' },
      },
      'Content-Disposition': {
        description: 'Disposição do conteúdo para download',
        schema: {
          type: 'string',
          example: 'attachment; filename="errors-uuid.csv"',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autorização inválido ou ausente',
    type: UnauthorizedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Importação não encontrada',
    type: NotFoundResponseDto,
  })
  async getErrorsCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.importsService.generateErrorsCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="errors-${id}.csv"`,
    );
    res.send(csv);
  }
}

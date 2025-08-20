import { ApiProperty } from '@nestjs/swagger';
import { EmpresaResponseDto } from './empresa-response.dto';

export class BoletoResponseDto {
  @ApiProperty({
    description: 'ID único do boleto',
    example: 'uuid-boleto-123',
  })
  id: string;

  @ApiProperty({
    description: 'Número do boleto gerado pela OlympiaBank',
    example: '00190.12345.12345.123456.12345.123456.7.89123456789',
  })
  numeroBoleto: string;

  @ApiProperty({
    description: 'Valor do boleto',
    example: 150.75,
    type: 'number',
  })
  valor: number;

  @ApiProperty({
    description: 'Data de vencimento',
    example: '2024-12-31',
  })
  vencimento: string;

  @ApiProperty({
    description: 'Status atual do boleto',
    example: 'gerado',
    enum: ['pendente', 'gerado', 'pago', 'vencido', 'cancelado', 'erro'],
  })
  status: string;

  @ApiProperty({
    description: 'URL para download/visualização do boleto',
    example: 'https://olympiabank.net/boleto/123456789',
    nullable: true,
  })
  urlBoleto: string | null;

  @ApiProperty({
    description: 'Mensagem de erro (se houver)',
    example: null,
    nullable: true,
  })
  mensagemErro: string | null;

  @ApiProperty({
    description: 'Número da linha na planilha original',
    example: 1,
  })
  numeroLinha: number;

  @ApiProperty({
    description: 'Dados da empresa associada',
    type: EmpresaResponseDto,
  })
  empresa: EmpresaResponseDto;

  @ApiProperty({
    description: 'Data de criação do boleto',
    example: '2024-01-01T10:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Data da última atualização',
    example: '2024-01-01T10:00:00.000Z',
  })
  updatedAt: string;
}
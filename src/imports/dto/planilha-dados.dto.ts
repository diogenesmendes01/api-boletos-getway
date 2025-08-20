import { ApiProperty } from '@nestjs/swagger';

export class PlanilhaDadosDto {
  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Empresa ABC Ltda',
  })
  nome: string;

  @ApiProperty({
    description: 'CNPJ da empresa (apenas números)',
    example: '12345678000199',
    pattern: '^[0-9]{14}$',
  })
  CNPJ: string;

  @ApiProperty({
    description: 'Endereço da empresa',
    example: 'Rua das Flores, 123',
  })
  endereco: string;

  @ApiProperty({
    description: 'Número do endereço',
    example: '123A',
  })
  numero: string;

  @ApiProperty({
    description: 'Bairro',
    example: 'Centro',
  })
  bairro: string;

  @ApiProperty({
    description: 'Estado (UF)',
    example: 'SP',
    pattern: '^[A-Z]{2}$',
  })
  estado: string;

  @ApiProperty({
    description: 'CEP (apenas números)',
    example: '01234567',
    pattern: '^[0-9]{8}$',
  })
  CEP: string;

  @ApiProperty({
    description: 'Valor do boleto',
    example: 150.75,
    type: 'number',
    format: 'decimal',
  })
  valor: number;

  @ApiProperty({
    description: 'Data de vencimento (formato DD/MM/AAAA)',
    example: '31/12/2024',
    pattern: '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$',
  })
  vencimento: string;
}
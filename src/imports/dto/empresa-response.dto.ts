import { ApiProperty } from '@nestjs/swagger';

export class EmpresaResponseDto {
  @ApiProperty({
    description: 'CNPJ da empresa',
    example: '12345678000199',
  })
  cnpj: string;

  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Empresa ABC Ltda',
  })
  nome: string;

  @ApiProperty({
    description: 'Endereço completo',
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
  })
  estado: string;

  @ApiProperty({
    description: 'CEP',
    example: '01234567',
  })
  cep: string;

  @ApiProperty({
    description: 'Data de criação do registro',
    example: '2024-01-01T10:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Data da última atualização',
    example: '2024-01-01T10:00:00.000Z',
  })
  updatedAt: string;
}
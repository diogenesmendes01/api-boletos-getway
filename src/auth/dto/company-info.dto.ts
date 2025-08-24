import { ApiProperty } from '@nestjs/swagger';

export class CompanyInfoDto {
  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Empresa ABC LTDA',
  })
  companyName: string;

  @ApiProperty({
    description: 'CNPJ da empresa',
    example: '12.345.678/0001-90',
  })
  companyDocument: string;

  @ApiProperty({
    description: 'Data de criação do registro',
    example: '2024-01-20T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Status da empresa',
    example: 'active',
  })
  status: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class CreateImportDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Arquivo CSV ou XLSX com os dados dos boletos. Colunas obrigatórias: nome, CNPJ, endereco, numero, bairro, estado, CEP, valor, vencimento',
    example: 'empresas_boletos.csv',
  })
  file: any;

  @ApiPropertyOptional({
    description:
      'URL do webhook para notificação quando a importação for concluída',
    example: 'https://webhook.site/your-unique-id',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}

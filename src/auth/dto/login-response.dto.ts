import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Token de acesso para a API',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'ID único do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Nome de usuário',
    example: 'usuario@empresa.com',
  })
  username: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'usuario@empresa.com',
  })
  email: string;

  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Empresa LTDA',
  })
  companyName: string;

  @ApiProperty({
    description: 'CNPJ da empresa',
    example: '12.345.678/0001-90',
  })
  companyDocument: string;

  @ApiProperty({
    description: 'Data de expiração do token',
    example: '2024-12-31T23:59:59.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Mensagem de sucesso',
    example: 'Login realizado com sucesso',
  })
  message: string;
}

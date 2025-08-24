import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Nome de usuário ou email',
    example: 'usuario@empresa.com',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Token do OlympiaBank',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  olympiaToken: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'usuario@empresa.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Nome da empresa',
    example: 'Empresa LTDA',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({
    description: 'CNPJ da empresa',
    example: '12.345.678/0001-90',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyDocument?: string;
}

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthGuard } from './auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login do usuário',
    description: 'Realiza login do usuário com email e token do OlympiaBank. A API busca automaticamente as informações da empresa.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'Token do OlympiaBank inválido',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout do usuário',
    description: 'Realiza logout do usuário, invalidando o token JWT',
  })
  @ApiBearerAuth('bearer-key')
  @ApiResponse({
    status: 200,
    description: 'Logout realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Logout realizado com sucesso',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido',
  })
  async logout(@Request() req): Promise<{ message: string }> {
    if (req.user.authType === 'jwt') {
      await this.authService.logout(req.user.userId);
    }
    
    return { message: 'Logout realizado com sucesso' };
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar token JWT',
    description: 'Renova o token JWT do usuário',
  })
  @ApiBearerAuth('bearer-key')
  @ApiResponse({
    status: 200,
    description: 'Token renovado com sucesso',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido',
  })
  async refresh(@Request() req): Promise<{ accessToken: string }> {
    if (req.user.authType !== 'jwt') {
      throw new Error('Refresh token only available for JWT authentication');
    }
    
    return this.authService.refreshToken(req.user.userId);
  }

  @Post('validate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validar token JWT',
    description: 'Valida o token JWT e retorna informações do usuário',
  })
  @ApiBearerAuth('bearer-key')
  @ApiResponse({
    status: 200,
    description: 'Token válido',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        user: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            companyName: { type: 'string' },
            companyDocument: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido',
  })
  async validate(@Request() req): Promise<{ valid: boolean; user: any }> {
    if (req.user.authType !== 'jwt') {
      return {
        valid: true,
        user: { client: req.user.client },
      };
    }

    const userToken = await this.authService.getUserToken(req.user.userId);
    
    return {
      valid: true,
      user: {
        userId: userToken.userId,
        username: userToken.username,
        email: userToken.email,
        companyName: userToken.companyName,
        companyDocument: userToken.companyDocument,
      },
    };
  }
}

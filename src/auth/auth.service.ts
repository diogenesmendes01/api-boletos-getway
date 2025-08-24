import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserToken } from '../entities/user-token.entity';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoggerService } from '../common/logger.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserToken)
    private userTokenRepository: Repository<UserToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private loggerService: LoggerService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email, olympiaToken } = loginDto;

    // Verificar se o usuário já existe
    let userToken = await this.userTokenRepository.findOne({
      where: { email },
    });

    if (userToken) {
      // Atualizar token existente
      userToken.olympiaToken = olympiaToken;
      userToken.lastUsedAt = new Date();
      userToken.updatedAt = new Date();
    } else {
      // Buscar informações da empresa via OlympiaBank API
      const companyInfo = await this.getCompanyInfoFromOlympia(olympiaToken);
      
      // Criar novo usuário
      userToken = this.userTokenRepository.create({
        userId: crypto.randomUUID(),
        username: email, // Usar email como username
        email,
        olympiaToken,
        companyName: companyInfo.companyName,
        companyDocument: companyInfo.companyDocument,
        isActive: true,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      });
    }

    // Salvar no banco
    await this.userTokenRepository.save(userToken);

    // Gerar JWT token
    const payload = {
      sub: userToken.userId,
      username: userToken.username,
      email: userToken.email,
      companyName: userToken.companyName,
      companyDocument: userToken.companyDocument,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '30d',
    });

    this.loggerService.info('User logged in successfully', {
      userId: userToken.userId,
      username: userToken.username,
      companyName: userToken.companyName,
      type: 'user_login_success',
    });

    return {
      accessToken,
      userId: userToken.userId,
      username: userToken.username,
      email: userToken.email,
      companyName: userToken.companyName,
      companyDocument: userToken.companyDocument,
      expiresAt: userToken.expiresAt,
      message: 'Login realizado com sucesso',
    };
  }

  async validateToken(token: string): Promise<UserToken> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userToken = await this.userTokenRepository.findOne({
        where: { userId: payload.sub, isActive: true },
      });

      if (!userToken) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      // Atualizar último uso
      userToken.lastUsedAt = new Date();
      await this.userTokenRepository.save(userToken);

      return userToken;
    } catch (error) {
      this.loggerService.warn('Token validation failed', {
        error: error.message,
        type: 'token_validation_failed',
      });
      throw new UnauthorizedException('Token inválido');
    }
  }

  async getUserToken(userId: string): Promise<UserToken> {
    const userToken = await this.userTokenRepository.findOne({
      where: { userId, isActive: true },
    });

    if (!userToken) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return userToken;
  }

  async logout(userId: string): Promise<void> {
    const userToken = await this.userTokenRepository.findOne({
      where: { userId },
    });

    if (userToken) {
      userToken.isActive = false;
      await this.userTokenRepository.save(userToken);

      this.loggerService.info('User logged out', {
        userId,
        username: userToken.username,
        type: 'user_logout',
      });
    }
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const userToken = await this.getUserToken(userId);

    const payload = {
      sub: userToken.userId,
      username: userToken.username,
      email: userToken.email,
      companyName: userToken.companyName,
      companyDocument: userToken.companyDocument,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '30d',
    });

    return { accessToken };
  }

  /**
   * Busca informações da empresa via OlympiaBank API
   */
  private async getCompanyInfoFromOlympia(olympiaToken: string): Promise<{
    companyName: string;
    companyDocument: string;
  }> {
    try {
      // Fazer uma chamada para a API do OlympiaBank para buscar informações da empresa
      // Por enquanto, vamos usar valores padrão baseados no token
      // Em produção, você pode implementar uma chamada real para a API
      
      this.loggerService.info('Fetching company info from OlympiaBank', {
        hasToken: !!olympiaToken,
        tokenPrefix: olympiaToken.substring(0, 10) + '...',
        type: 'company_info_fetch',
      });

      // TODO: Implementar chamada real para OlympiaBank API
      // const response = await this.httpService.get(`${olympiaBaseUrl}/v1/company/profile`, {
      //   headers: { Authorization: `Bearer ${olympiaToken}` }
      // });
      
      // Por enquanto, retornar valores baseados no hash do token
      const tokenHash = crypto.createHash('md5').update(olympiaToken).digest('hex');
      const companyId = tokenHash.substring(0, 8);
      
      return {
        companyName: `Empresa ${companyId.toUpperCase()}`,
        companyDocument: `${companyId.substring(0, 2)}.${companyId.substring(2, 5)}.${companyId.substring(5, 7)}/0001-${companyId.substring(7, 8)}`,
      };
    } catch (error) {
      this.loggerService.warn('Failed to fetch company info from OlympiaBank', {
        error: error.message,
        type: 'company_info_fetch_failed',
      });

      // Retornar valores padrão em caso de erro
      return {
        companyName: 'Empresa não identificada',
        companyDocument: '00.000.000/0000-00',
      };
    }
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger.service';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private apiKeys: Map<string, string>;

  constructor(
    private configService: ConfigService,
    private loggerService: LoggerService,
    private authService: AuthService,
  ) {
    this.apiKeys = new Map();
    const keys = this.configService.get<string>('CLIENT_API_KEYS', '');

    if (keys) {
      keys.split(',').forEach(pair => {
        const [client, key] = pair.split(':');
        if (client && key) {
          this.apiKeys.set(key, client);
        }
      });
    }

    this.loggerService.info('AuthGuard initialized', {
      clientCount: this.apiKeys.size,
      type: 'auth_initialization',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const ip = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const traceId = request.traceId;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.loggerService.logAuth({
        action: 'token_validation',
        ip,
        userAgent,
        success: false,
        reason: 'Missing or invalid authorization header',
      });

      this.loggerService.logSecurity({
        event: 'Authentication attempt without proper authorization header',
        severity: 'medium',
        ip,
        userAgent,
        details: {
          traceId,
          url: request.url,
          method: request.method,
          authHeader: authHeader ? 'present_but_invalid' : 'missing',
        },
      });

      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.substring(7);

    // Primeiro, tentar validar como JWT
    try {
      const userToken = await this.authService.validateToken(token);

      this.loggerService.logAuth({
        action: 'token_validation',
        userId: userToken.userId,
        ip,
        userAgent,
        success: true,
      });

      request.user = {
        userId: userToken.userId,
        username: userToken.username,
        email: userToken.email,
        companyName: userToken.companyName,
        companyDocument: userToken.companyDocument,
        authType: 'jwt',
      };

      return true;
    } catch (jwtError) {
      // Se JWT falhar, tentar como API key
      const client = this.apiKeys.get(token);

      if (!client) {
        this.loggerService.logAuth({
          action: 'token_validation',
          ip,
          userAgent,
          success: false,
          reason: 'Invalid JWT token and API key',
        });

        this.loggerService.logSecurity({
          event: 'Authentication attempt with invalid JWT and API key',
          severity: 'high',
          ip,
          userAgent,
          details: {
            traceId,
            url: request.url,
            method: request.method,
            tokenPrefix: token.substring(0, 8) + '...',
          },
        });

        throw new UnauthorizedException('Invalid token or API key');
      }

      // Log sucesso na autenticação com API key
      this.loggerService.logAuth({
        action: 'token_validation',
        userId: client,
        ip,
        userAgent,
        success: true,
      });

      this.loggerService.debug('Client authenticated with API key', {
        client,
        ip,
        traceId,
        type: 'auth_success_api_key',
      });

      request.user = {
        client,
        authType: 'api_key',
      };
      return true;
    }
  }
}

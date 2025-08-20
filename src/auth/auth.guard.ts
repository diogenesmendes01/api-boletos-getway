import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  private apiKeys: Map<string, string>;

  constructor(private configService: ConfigService) {
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
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const client = this.apiKeys.get(token);

    if (!client) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.user = { client };
    return true;
  }
}
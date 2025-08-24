import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoggerService } from '../common/logger.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggerService = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAuth: jest.fn(),
    logSecurity: jest.fn(),
  };

  const mockAuthService = {
    validateToken: jest.fn(),
    getUserToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
    const mockRequest = {
      headers: authHeader ? { authorization: authHeader } : {},
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let testGuard: AuthGuard;
    
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('clienteA:token123,clienteB:token456');
      testGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
    });

    it('should allow access with valid token', async () => {
      const context = createMockExecutionContext('Bearer token123');

      const result = await testGuard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({ client: 'clienteA', authType: 'api_key' });
    });

    it('should allow access with second valid token', async () => {
      const context = createMockExecutionContext('Bearer token456');

      const result = await testGuard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({ client: 'clienteB', authType: 'api_key' });
    });

    it('should reject request without authorization header', async () => {
      const context = createMockExecutionContext();

      await expect(testGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(testGuard.canActivate(context)).rejects.toThrow('Missing or invalid authorization header');
    });

    it('should reject request with malformed authorization header', async () => {
      const context = createMockExecutionContext('InvalidHeader token123');

      await expect(testGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(testGuard.canActivate(context)).rejects.toThrow('Missing or invalid authorization header');
    });

    it('should reject request with invalid token', async () => {
      const context = createMockExecutionContext('Bearer invalid-token');

      await expect(testGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(testGuard.canActivate(context)).rejects.toThrow('Invalid token or API key');
    });

    it('should reject request with empty token', async () => {
      const context = createMockExecutionContext('Bearer ');

      await expect(testGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(testGuard.canActivate(context)).rejects.toThrow('Invalid token or API key');
    });

    it('should handle empty CLIENT_API_KEYS config', async () => {
      mockConfigService.get.mockReturnValue('');
      const emptyGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
      
      const context = createMockExecutionContext('Bearer token123');

      await expect(emptyGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(emptyGuard.canActivate(context)).rejects.toThrow('Invalid token or API key');
    });

    it('should handle malformed CLIENT_API_KEYS config', async () => {
      mockConfigService.get.mockReturnValue('invalidformat');
      const malformedGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
      
      const context = createMockExecutionContext('Bearer token123');

      await expect(malformedGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(malformedGuard.canActivate(context)).rejects.toThrow('Invalid token or API key');
    });

    it('should handle CLIENT_API_KEYS with empty client or key', async () => {
      mockConfigService.get.mockReturnValue('clienteA:,clienteB:token456,:token789');
      const mixedGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
      
      const context = createMockExecutionContext('Bearer token456');

      const result = await mixedGuard.canActivate(context);
      expect(result).toBe(true);
      
      const invalidContext = createMockExecutionContext('Bearer token789');
      await expect(mixedGuard.canActivate(invalidContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle multiple valid tokens for same client', async () => {
      mockConfigService.get.mockReturnValue('clienteA:token1,clienteA:token2');
      const multiGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
      
      const context1 = createMockExecutionContext('Bearer token1');
      const context2 = createMockExecutionContext('Bearer token2');

      expect(await multiGuard.canActivate(context1)).toBe(true);
      expect(await multiGuard.canActivate(context2)).toBe(true);
      
      expect(context1.switchToHttp().getRequest().user).toEqual({ client: 'clienteA', authType: 'api_key' });
      expect(context2.switchToHttp().getRequest().user).toEqual({ client: 'clienteA', authType: 'api_key' });
    });

    it('should be case sensitive with tokens', async () => {
      mockConfigService.get.mockReturnValue('clienteA:Token123');
      const sensitiveGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
      
      const context = createMockExecutionContext('Bearer token123');

      await expect(sensitiveGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(sensitiveGuard.canActivate(context)).rejects.toThrow('Invalid token or API key');
    });
  });

  describe('initialization', () => {
    it('should initialize with empty config', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      
      const testGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);
      const context = createMockExecutionContext('Bearer anytoken');

      await expect(testGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should parse config correctly on initialization', async () => {
      const spy = jest.spyOn(configService, 'get');
      spy.mockReturnValue('client1:key1,client2:key2');

      const testGuard = new AuthGuard(configService, mockLoggerService as any, mockAuthService as any);

      expect(spy).toHaveBeenCalledWith('CLIENT_API_KEYS', '');
      
      const context1 = createMockExecutionContext('Bearer key1');
      const context2 = createMockExecutionContext('Bearer key2');

      expect(await testGuard.canActivate(context1)).toBe(true);
      expect(await testGuard.canActivate(context2)).toBe(true);
    });
  });
});
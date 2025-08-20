import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
      testGuard = new AuthGuard(configService);
    });

    it('should allow access with valid token', () => {
      const context = createMockExecutionContext('Bearer token123');

      const result = testGuard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({ client: 'clienteA' });
    });

    it('should allow access with second valid token', () => {
      const context = createMockExecutionContext('Bearer token456');

      const result = testGuard.canActivate(context);

      expect(result).toBe(true);
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({ client: 'clienteB' });
    });

    it('should reject request without authorization header', () => {
      const context = createMockExecutionContext();

      expect(() => testGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => testGuard.canActivate(context)).toThrow('Missing or invalid authorization header');
    });

    it('should reject request with malformed authorization header', () => {
      const context = createMockExecutionContext('InvalidHeader token123');

      expect(() => testGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => testGuard.canActivate(context)).toThrow('Missing or invalid authorization header');
    });

    it('should reject request with invalid token', () => {
      const context = createMockExecutionContext('Bearer invalid-token');

      expect(() => testGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => testGuard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should reject request with empty token', () => {
      const context = createMockExecutionContext('Bearer ');

      expect(() => testGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => testGuard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should handle empty CLIENT_API_KEYS config', () => {
      mockConfigService.get.mockReturnValue('');
      const emptyGuard = new AuthGuard(configService);
      
      const context = createMockExecutionContext('Bearer token123');

      expect(() => emptyGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => emptyGuard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should handle malformed CLIENT_API_KEYS config', () => {
      mockConfigService.get.mockReturnValue('invalidformat');
      const malformedGuard = new AuthGuard(configService);
      
      const context = createMockExecutionContext('Bearer token123');

      expect(() => malformedGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => malformedGuard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should handle CLIENT_API_KEYS with empty client or key', () => {
      mockConfigService.get.mockReturnValue('clienteA:,clienteB:token456,:token789');
      const mixedGuard = new AuthGuard(configService);
      
      const context = createMockExecutionContext('Bearer token456');

      const result = mixedGuard.canActivate(context);
      expect(result).toBe(true);
      
      const invalidContext = createMockExecutionContext('Bearer token789');
      expect(() => mixedGuard.canActivate(invalidContext)).toThrow(UnauthorizedException);
    });

    it('should handle multiple valid tokens for same client', () => {
      mockConfigService.get.mockReturnValue('clienteA:token1,clienteA:token2');
      const multiGuard = new AuthGuard(configService);
      
      const context1 = createMockExecutionContext('Bearer token1');
      const context2 = createMockExecutionContext('Bearer token2');

      expect(multiGuard.canActivate(context1)).toBe(true);
      expect(multiGuard.canActivate(context2)).toBe(true);
      
      expect(context1.switchToHttp().getRequest().user).toEqual({ client: 'clienteA' });
      expect(context2.switchToHttp().getRequest().user).toEqual({ client: 'clienteA' });
    });

    it('should be case sensitive with tokens', () => {
      mockConfigService.get.mockReturnValue('clienteA:Token123');
      const sensitiveGuard = new AuthGuard(configService);
      
      const context = createMockExecutionContext('Bearer token123');

      expect(() => sensitiveGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => sensitiveGuard.canActivate(context)).toThrow('Invalid API key');
    });
  });

  describe('initialization', () => {
    it('should initialize with empty config', () => {
      mockConfigService.get.mockReturnValue(undefined);
      
      const testGuard = new AuthGuard(configService);
      const context = createMockExecutionContext('Bearer anytoken');

      expect(() => testGuard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should parse config correctly on initialization', () => {
      const spy = jest.spyOn(configService, 'get');
      spy.mockReturnValue('client1:key1,client2:key2');

      const testGuard = new AuthGuard(configService);

      expect(spy).toHaveBeenCalledWith('CLIENT_API_KEYS', '');
      
      const context1 = createMockExecutionContext('Bearer key1');
      const context2 = createMockExecutionContext('Bearer key2');

      expect(testGuard.canActivate(context1)).toBe(true);
      expect(testGuard.canActivate(context2)).toBe(true);
    });
  });
});
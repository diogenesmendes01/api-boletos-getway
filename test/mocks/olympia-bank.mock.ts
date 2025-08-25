import { AxiosResponse, AxiosError } from 'axios';

export interface MockBoletoRequest {
  amount: number;
  client: {
    name: string;
    document: string;
    telefone: string;
    email: string;
  };
  utms: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
  };
  product: {
    name_product: string;
    valor_product: string;
  };
  split: {
    user: string;
    value: string;
  };
}

export interface MockBoletoResponse {
  idTransaction: string;
  boletoUrl: string;
  boletoCode: string;
  pdf: string;
  dueDate: string;
}

export class OlympiaBankMock {
  private static requestCount = 0;

  static createSuccessResponse(
    _request: MockBoletoRequest,
  ): AxiosResponse<MockBoletoResponse> {
    this.requestCount++;

    const transactionId = `TXN${Date.now()}${this.requestCount}`;
    const boletoCode = `BOL${this.requestCount.toString().padStart(6, '0')}`;

    return {
      data: {
        idTransaction: transactionId,
        boletoUrl: `https://boleto.olympiabank.net/${transactionId}`,
        boletoCode,
        pdf: `base64-encoded-pdf-content-${transactionId}`,
        dueDate: '2024-12-31',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
  }

  static createRateLimitError(retryAfter: number = 60): AxiosError {
    const error = new AxiosError('Too Many Requests');
    error.response = {
      status: 429,
      statusText: 'Too Many Requests',
      data: {
        error: 'rate_limit_exceeded',
        message: 'Rate limit exceeded. Try again later.',
      },
      headers: {
        'retry-after': retryAfter.toString(),
        'x-ratelimit-limit': '100',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': (Date.now() + retryAfter * 1000).toString(),
      },
      config: {} as any,
    };
    return error;
  }

  static createServerError(statusCode: number = 500): AxiosError {
    const error = new AxiosError('Internal Server Error');
    error.response = {
      status: statusCode,
      statusText: 'Internal Server Error',
      data: {
        error: 'internal_server_error',
        message: 'An internal error occurred while processing your request.',
        timestamp: new Date().toISOString(),
      },
      headers: {},
      config: {} as any,
    };
    return error;
  }

  static createValidationError(): AxiosError {
    const error = new AxiosError('Bad Request');
    error.response = {
      status: 400,
      statusText: 'Bad Request',
      data: {
        error: 'validation_error',
        message: 'Invalid request parameters.',
        details: [
          {
            field: 'client.document',
            message: 'Invalid CPF/CNPJ format',
          },
        ],
      },
      headers: {},
      config: {} as any,
    };
    return error;
  }

  static createUnauthorizedError(): AxiosError {
    const error = new AxiosError('Unauthorized');
    error.response = {
      status: 401,
      statusText: 'Unauthorized',
      data: {
        error: 'unauthorized',
        message: 'Invalid or expired API token.',
      },
      headers: {},
      config: {} as any,
    };
    return error;
  }

  static createNetworkError(): AxiosError {
    const error = new AxiosError('Network Error');
    error.code = 'ECONNREFUSED';
    return error;
  }

  static createTimeoutError(): AxiosError {
    const error = new AxiosError('Request Timeout');
    error.code = 'ECONNABORTED';
    error.response = {
      status: 408,
      statusText: 'Request Timeout',
      data: {},
      headers: {},
      config: {} as any,
    };
    return error;
  }

  static validateRequest(request: MockBoletoRequest): boolean {
    // Validações básicas do payload
    if (!request.amount || request.amount <= 0) return false;
    if (!request.client?.name) return false;
    if (!request.client?.document) return false;
    if (!request.client?.email) return false;
    if (!request.client?.telefone) return false;

    // Validar formato do documento
    const document = request.client.document;
    if (document.length !== 11 && document.length !== 14) return false;

    // Validar email básico
    if (!request.client.email.includes('@')) return false;

    // Validar telefone básico
    if (request.client.telefone.length < 10) return false;

    return true;
  }

  static resetCounter(): void {
    this.requestCount = 0;
  }

  static getRequestCount(): number {
    return this.requestCount;
  }

  // Simulação de cenários específicos baseados nos dados
  static createResponseBasedOnDocument(
    document: string,
  ): AxiosResponse<MockBoletoResponse> | AxiosError {
    // Documentos que simulam diferentes cenários
    const scenarios = {
      // CPF que sempre falha com rate limit
      '11111111111': () => this.createRateLimitError(30),
      // CPF que falha com erro do servidor
      '22222222222': () => this.createServerError(500),
      // CPF que falha com validação
      '33333333333': () => this.createValidationError(),
      // CPF que falha com auth
      '44444444444': () => this.createUnauthorizedError(),
      // CPF que falha com timeout
      '55555555555': () => this.createTimeoutError(),
    };

    const scenario = scenarios[document];
    if (scenario) {
      return scenario();
    }

    // Default: sucesso
    return this.createSuccessResponse({
      amount: 1500,
      client: {
        name: 'Test User',
        document,
        telefone: '5511987654321',
        email: 'test@example.com',
      },
      utms: {
        utm_source: 'import',
        utm_medium: 'batch',
        utm_campaign: 'bulk',
      },
      product: {
        name_product: 'Boleto',
        valor_product: '15.00',
      },
      split: {
        user: 'default',
        value: '0',
      },
    });
  }
}

// Helper para criar um mock completo do HttpService
export const createHttpServiceMock = (
  behavior: 'success' | 'rate-limit' | 'server-error' | 'custom' = 'success',
) => {
  return {
    post: jest
      .fn()
      .mockImplementation((url: string, data: MockBoletoRequest) => {
        switch (behavior) {
          case 'success':
            return {
              toPromise: () =>
                Promise.resolve(OlympiaBankMock.createSuccessResponse(data)),
            };
          case 'rate-limit':
            return {
              toPromise: () =>
                Promise.reject(OlympiaBankMock.createRateLimitError()),
            };
          case 'server-error':
            return {
              toPromise: () =>
                Promise.reject(OlympiaBankMock.createServerError()),
            };
          default:
            return {
              toPromise: () =>
                Promise.resolve(OlympiaBankMock.createSuccessResponse(data)),
            };
        }
      }),
  };
};

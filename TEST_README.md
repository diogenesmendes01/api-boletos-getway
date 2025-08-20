# Guia de Testes - API Boletos Gateway

Este documento descreve a estrutura completa de testes implementada no projeto.

## Estrutura de Testes

### 📋 Resumo dos Testes

- **Testes Unitários**: 200+ testes para validação, parsing e lógica de negócio
- **Testes de Integração**: Fluxo completo entre controllers e services
- **Testes E2E**: Validação end-to-end da API
- **Mocks**: Simulação completa da API OlympiaBank
- **Fixtures**: Arquivos de teste para diferentes cenários

### 🗂️ Organização

```
test/
├── fixtures/                    # Arquivos de teste (CSV/XLSX)
│   ├── valid-sample.csv        # Dados válidos
│   ├── invalid-sample.csv      # Dados inválidos
│   ├── mixed-formats.csv       # Formatos diversos
│   └── large-sample.csv        # Arquivo com 20+ linhas
├── mocks/                      # Mocks para APIs externas
│   └── olympia-bank.mock.ts    # Mock da API OlympiaBank
├── integration/                # Testes de integração
│   └── import-processor.integration.spec.ts
├── *.e2e-spec.ts              # Testes end-to-end
├── file-fixtures.spec.ts       # Validação dos fixtures
├── setup-e2e.ts              # Setup para testes E2E
└── jest-e2e.json              # Configuração Jest E2E

src/
├── **/*.spec.ts               # Testes unitários
```

## Comandos de Teste

### Executar Todos os Testes
```bash
npm run test:all           # Unit + Integration + E2E
npm run test:ci            # Para CI/CD (sem watch)
```

### Testes Específicos
```bash
npm test                   # Testes unitários
npm run test:unit          # Apenas testes unitários
npm run test:integration   # Apenas testes de integração
npm run test:e2e          # Apenas testes E2E
npm run test:fixtures     # Validação de arquivos de teste
```

### Desenvolvimento
```bash
npm run test:watch        # Watch mode para desenvolvimento
npm run test:cov          # Com cobertura de código
npm run test:debug        # Debug mode
```

## Testes Unitários

### FileProcessorService
- ✅ Parsing de CSV e XLSX
- ✅ Validação de CPF/CNPJ com algoritmo completo
- ✅ Normalização de telefones (adiciona +55)
- ✅ Validação de email com regex
- ✅ Conversão de valores (R$/centavos)
- ✅ Parsing de datas (ISO/BR)
- ✅ Tratamento de formatos diversos

```typescript
// Exemplo de teste
it('should parse amount with currency symbols', () => {
  const amount = 'R$ 15,50';
  const result = service['parseAmount'](amount);
  expect(result).toBe(1550); // Convertido para centavos
});
```

### OlympiaBankService
- ✅ Integração com API externa
- ✅ Rate limiting e backoff
- ✅ Tratamento de erros 4xx/5xx
- ✅ Retry automático
- ✅ Timeout handling

### ImportsService
- ✅ Criação de importações
- ✅ Geração de relatórios CSV
- ✅ Status tracking
- ✅ Webhook integration

### AuthGuard
- ✅ Validação de Bearer Token
- ✅ Múltiplos clients/keys
- ✅ Error handling

### Controllers
- ✅ Upload de arquivos
- ✅ Endpoints REST
- ✅ Validação de parâmetros
- ✅ Error responses

## Testes de Integração

### ImportProcessor
- ✅ Processamento completo de importações
- ✅ Integração com OlympiaBank (mocked)
- ✅ Handling de sucessos e falhas
- ✅ Retry logic com rate limiting
- ✅ Webhook notifications
- ✅ Transaction persistence

```typescript
// Exemplo de cenário complexo
it('should handle mixed success/failure with retries', async () => {
  // Simula 1 sucesso, 1 falha com retry, 1 falha permanente
  mockHttpService.post
    .mockReturnValueOnce(successResponse)
    .mockRejectedValueOnce(rateLimitError)
    .mockReturnValueOnce(successResponse)
    .mockRejectedValueOnce(permanentError);

  await processor.processImport(job);
  
  expect(transactionRepository.save).toHaveBeenCalledTimes(2);
  expect(importRepository.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'completed' })
  );
});
```

## Testes E2E

### API Endpoints
- ✅ `POST /v1/imports` - Upload com autenticação
- ✅ `GET /v1/imports/:id` - Status da importação
- ✅ `GET /v1/imports/:id/results.csv` - Download de sucessos
- ✅ `GET /v1/imports/:id/errors.csv` - Download de erros
- ✅ `GET /v1/imports/:id/events` - Server-Sent Events
- ✅ `GET /v1/health` - Health checks

### Cenários Testados
- ✅ Upload com webhook URL
- ✅ Autenticação e autorização
- ✅ Headers HTTP corretos
- ✅ Formatos de response
- ✅ Error handling (400, 401, 404)

```typescript
// Exemplo de teste E2E
it('should create import with valid CSV', async () => {
  const response = await request(app.getHttpServer())
    .post('/v1/imports')
    .set('Authorization', 'Bearer token123')
    .attach('file', path.join(__dirname, 'fixtures/valid-sample.csv'))
    .expect(201);

  expect(response.body).toEqual({
    importId: expect.any(String),
    status: 'queued',
    maxRows: 2000,
  });
});
```

## Mocks e Fixtures

### OlympiaBankMock
Mock completo da API OlympiaBank com diferentes cenários:

```typescript
// Sucessos
OlympiaBankMock.createSuccessResponse(request);

// Erros específicos
OlympiaBankMock.createRateLimitError(60); // Rate limit com retry-after
OlympiaBankMock.createServerError(500);   // Erro do servidor
OlympiaBankMock.createValidationError();  // Erro de validação
OlympiaBankMock.createNetworkError();     // Erro de rede

// Cenários baseados em documento
OlympiaBankMock.createResponseBasedOnDocument('11111111111'); // Rate limit
OlympiaBankMock.createResponseBasedOnDocument('22222222222'); // Server error
```

### Arquivos de Teste
- **valid-sample.csv**: 5 registros válidos com formatos diversos
- **invalid-sample.csv**: Registros com erros de validação
- **mixed-formats.csv**: CPF/CNPJ formatados, valores com R$, telefones com máscaras
- **large-sample.csv**: 20 registros para teste de performance

## Cobertura de Código

### Métricas Esperadas
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Gerar Relatório
```bash
npm run test:cov
```

Abre automaticamente o relatório em `coverage/lcov-report/index.html`

## Cenários de Teste

### ✅ Validação de Dados
- CPF/CNPJ com dígito verificador
- Telefones com/sem código do país
- Emails com regex completo
- Valores em reais/centavos
- Datas ISO/BR

### ✅ Integração OlympiaBank
- Chamadas bem-sucedidas
- Rate limiting (429)
- Erros de servidor (5xx)
- Erros de validação (4xx)
- Timeouts e falhas de rede
- Retry com backoff exponencial

### ✅ Processamento Assíncrono
- Filas com BullMQ
- Processamento em lotes
- Concorrência configurável
- Status tracking em tempo real

### ✅ Relatórios e Downloads
- CSV de sucessos
- CSV de erros
- Headers HTTP corretos
- Encoding UTF-8

### ✅ Webhooks
- Notificações de conclusão
- Falhas de webhook (não afetam processamento)
- Timeout handling

### ✅ Autenticação
- Bearer tokens múltiplos
- Clientes diferentes
- Tokens inválidos/expirados

## Executando em CI/CD

### GitHub Actions / Jenkins
```yaml
- name: Run Tests
  run: |
    npm install
    npm run test:ci
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run test:ci
```

## Debugging

### Logs Detalhados
```bash
DEBUG=* npm test
```

### Testes Específicos
```bash
npm test -- --testNamePattern="should parse CSV"
npm test -- --testPathPattern="file-processor"
```

### Debug no VSCode
Configuração em `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "env": {
    "NODE_ENV": "test"
  }
}
```

## Melhores Práticas

### ✅ Implementadas
- Mocks para dependências externas
- Fixtures para dados de teste
- Setup/teardown em cada teste
- Timeouts apropriados
- Error cases cobertos
- Async/await consistente
- Nomes descritivos de teste

### 🔄 Padrões
- **AAA**: Arrange, Act, Assert
- **Given-When-Then**: Para testes complexos
- **Isolation**: Cada teste independente
- **Deterministic**: Resultados previsíveis

## Troubleshooting

### Problemas Comuns

**1. Timeout em testes E2E**
```bash
# Aumentar timeout
jest.setTimeout(30000);
```

**2. Porta em uso**
```bash
# Usar porta diferente para testes
API_PORT=3001 npm run test:e2e
```

**3. Fixtures não encontrados**
```bash
# Verificar caminho dos arquivos
ls test/fixtures/
```

**4. Mocks não funcionando**
```bash
# Limpar mocks entre testes
afterEach(() => jest.clearAllMocks());
```

## Contribuindo

### Adicionando Novos Testes
1. Seguir padrão de naming: `*.spec.ts` para unitários, `*.e2e-spec.ts` para E2E
2. Usar mocks adequados
3. Cobrir casos de sucesso e erro
4. Documentar cenários complexos
5. Manter fixtures atualizados

### Review Checklist
- [ ] Testes passando
- [ ] Cobertura adequada
- [ ] Mocks apropriados
- [ ] Casos de erro cobertos
- [ ] Performance aceitável
- [ ] Documentação atualizada
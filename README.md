# 🎯 API Boletos Gateway

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Tests](https://img.shields.io/badge/tests-82%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)]()
[![NestJS](https://img.shields.io/badge/NestJS-10.3-red)]()
[![Docker](https://img.shields.io/badge/Docker-ready-blue)]()

API assíncrona robusta para importação em massa e geração de boletos via **OlympiaBank**, com sistema de logging profissional e monitoramento completo para produção.

## ✨ Funcionalidades Principais

### 🚀 **Processamento Assíncrono**
- Upload de arquivos **CSV/XLSX** (até 2.000 linhas)
- Processamento em **batches** com controle de concorrência
- **Queue system** com BullMQ e Redis
- **Retry automático** com backoff exponencial

### 🔗 **Integração Completa**
- **OlympiaBank API** com rate limiting inteligente
- **Webhooks** para notificação de conclusão
- **Server-Sent Events (SSE)** para tempo real
- **Health checks** detalhados

### 📊 **Sistema de Logging Profissional**
- **Winston Logger** com logs estruturados
- **Trace IDs** únicos por requisição
- **Rotação automática** de arquivos de log
- **Logs de segurança** e auditoria
- **Métricas de performance** e APIs externas

### 🔐 **Segurança e Monitoramento**
- **Autenticação via API Key** multi-cliente
- **Logs de segurança** com detecção de ameaças
- **Rate limiting** e controle de abuso
- **Sanitização** de dados sensíveis nos logs

### 📈 **Relatórios e Análise**
- **CSV de sucessos** com URLs dos boletos
- **CSV de erros** com códigos e mensagens
- **Métricas detalhadas** de processamento
- **Acompanhamento em tempo real**

## 🛠️ Tecnologias

| Categoria | Tecnologia |
|-----------|------------|
| **Runtime** | Node.js 20+ |
| **Framework** | NestJS 10.3 |
| **Linguagem** | TypeScript 5.3 |
| **Banco de Dados** | PostgreSQL 15+ |
| **Cache/Queue** | Redis 7+ |
| **Logging** | Winston |
| **Testes** | Jest |
| **Containerização** | Docker + Docker Compose |

## 🚀 Instalação Rápida

### 🐳 Com Docker (Recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/api-boletos-gateway.git
cd api-boletos-gateway

# 2. Configure as variáveis de ambiente
cp .env.example .env
# ✏️ Edite o arquivo .env com suas configurações

# 3. Inicie todos os serviços
docker-compose -f docker-compose.prod.yml up -d

# 4. Verifique o status
docker-compose ps
```

### ⚙️ Instalação Local

```bash
# 1. Instale as dependências
npm install

# 2. Configure PostgreSQL e Redis localmente
# ✏️ Atualize o arquivo .env com as conexões

# 3. Execute as migrations
npm run migration:run

# 4. Inicie a aplicação
npm run start:dev

# 5. Em outro terminal, inicie o worker
npm run start:worker
```

## 📝 Configuração

### 🔑 Variáveis de Ambiente

```bash
# ===== APLICAÇÃO =====
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ===== BANCO DE DADOS =====
DB_HOST=postgres-olympia
DB_PORT=5432
DB_USERNAME=olympia_app
DB_PASSWORD=sua_senha_super_segura
DB_DATABASE=boleto_db

# ===== REDIS =====
REDIS_URL=redis://redis-boleto:6379

# ===== API OLYMPIABANK =====
OLYMPIA_BASE_URL=https://api.olympiabank.net
OLYMPIA_TOKEN=seu_token_olympia

# ===== AUTENTICAÇÃO =====
CLIENT_API_KEYS=cliente1:token_super_secreto_1,cliente2:token_super_secreto_2

# ===== PERFORMANCE =====
MAX_CONCURRENCY=12
MAX_RETRIES=5

# ===== OUTROS =====
API_BASE_URL=https://api.seu-dominio.com
CORS_ORIGINS=https://seu-frontend.com
```

### 🔐 Configuração de Autenticação

Configure múltiplos clientes no formato:
```bash
CLIENT_API_KEYS=empresa_a:abc123xyz,empresa_b:def456uvw,empresa_c:ghi789rst
```

Use no header das requisições:
```bash
Authorization: Bearer abc123xyz
```

## 📚 Documentação da API

### Base URL
```
Produção: https://api.envio-boleto.olympiabank.xyz/v1
Desenvolvimento: http://localhost:3000/v1
Swagger: 
  - Produção: https://api.envio-boleto.olympiabank.xyz/docs
  - Desenvolvimento: http://localhost:3000/docs
```

### 🔐 **POST /v1/auth/login** - Login do Usuário

**Body:**
```json
{
  "email": "usuario@empresa.com",
  "olympiaToken": "seu_token_olympia"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "username": "usuario@empresa.com",
  "email": "usuario@empresa.com",
  "companyName": "Empresa ABC LTDA",
  "companyDocument": "12.345.678/0001-90",
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "message": "Login realizado com sucesso"
}
```

### 🔄 **POST /v1/imports** - Upload de Arquivo

**Headers:**
```json
{
  \"Authorization\": \"Bearer seu_jwt_token\",
  \"Content-Type\": \"multipart/form-data\"
}
```

**Body:**
```bash
curl -X POST \"http://localhost:3000/v1/imports\" \\
  -H \"Authorization: Bearer seu_jwt_token\" \\
  -F \"file=@boletos.csv\" \\
  -F \"webhookUrl=https://sua-api.com/webhook\"
```

**Response:**
```json
{
  \"importId\": \"123e4567-e89b-12d3-a456-426614174000\",
  \"status\": \"queued\",
  \"maxRows\": 2000
}
```

### 📊 **GET /v1/imports/{id}** - Status da Importação

**Response:**
```json
{
  \"id\": \"123e4567-e89b-12d3-a456-426614174000\",
  \"status\": \"processing\",
  \"filename\": \"boletos.csv\",
  \"createdAt\": \"2024-01-20T10:30:00.000Z\",
  \"startedAt\": \"2024-01-20T10:30:05.000Z\",
  \"stats\": {
    \"total\": 1000,
    \"processed\": 750,
    \"success\": 720,
    \"error\": 30
  },
  \"links\": {
    \"results\": \"http://api/v1/imports/{id}/results.csv\",
    \"errors\": \"http://api/v1/imports/{id}/errors.csv\"
  }
}
```

**Status possíveis:**
- `queued` - Na fila para processamento
- `processing` - Sendo processado
- `completed` - Concluído com sucesso
- `failed` - Falhou por erro crítico

### 🔄 **GET /v1/imports/{id}/events** - Tempo Real (SSE)

```javascript
const eventSource = new EventSource('/v1/imports/123.../events', {
  headers: { 'Authorization': 'Bearer seu_token' }
});

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Progress:', data.stats);
};
```

### 📥 **GET /v1/imports/{id}/results.csv** - Download Sucessos

Retorna CSV com colunas:
```csv
name,document,amount,idTransaction,boletoCode,boletoUrl,pdf,dueDate
```

### ❌ **GET /v1/imports/{id}/errors.csv** - Download Erros

Retorna CSV com colunas:
```csv
name,document,amount,errorCode,errorMessage,retryCount
```

### 🏥 **GET /v1/health** - Health Check

```json
{
  \"status\": \"ok\",
  \"info\": {
    \"database\": { \"status\": \"up\" },
    \"redis\": { \"status\": \"up\" },
    \"olympiaBank\": { \"status\": \"up\" }
  }
}
```

## 📄 Formato do Arquivo

### CSV/XLSX Obrigatório

| Coluna | Tipo | Formato | Exemplo | Obrigatório |
|--------|------|---------|---------|-------------|
| **amount** | Número | Centavos ou decimais | `1500` ou `15.00` | ✅ |
| **name** | Texto | Nome completo | `João Silva Santos` | ✅ |
| **document** | Número | CPF/CNPJ limpo | `11144477735` | ✅ |
| **telefone** | Número | DDD + número | `11987654321` | ✅ |
| **email** | Email | Email válido | `joao@empresa.com` | ✅ |
| **vencimento** | Data | ISO ou BR | `2024-12-31` ou `31/12/2024` | ❌ |

### Exemplo CSV:
```csv
amount,name,document,telefone,email,vencimento
1500,João Silva,11144477735,11987654321,joao@test.com,2024-12-31
2000,Maria Santos,22255588844,11976543210,maria@test.com,31/12/2024
```

## 📊 Sistema de Logging

### 🎯 **Logs Estruturados em Produção**

```json
{
  \"timestamp\": \"2024-01-20T10:30:00.000Z\",
  \"level\": \"info\",
  \"message\": \"HTTP Request\",
  \"service\": \"api-boletos-gateway\",
  \"environment\": \"production\",
  \"type\": \"http_request\",
  \"traceId\": \"123e4567-e89b-12d3-a456-426614174000\",
  \"method\": \"POST\",
  \"url\": \"/v1/imports\",
  \"userAgent\": \"curl/7.68.0\",
  \"ip\": \"192.168.1.100\",
  \"userId\": \"empresa_a\"
}
```

### 📁 **Arquivos de Log**

```bash
/app/logs/
├── application-2024-01-20.log    # Logs gerais
├── application-2024-01-21.log
├── error-2024-01-20.log          # Apenas erros  
└── error-2024-01-21.log
```

### 🔍 **Tipos de Log Monitorados**

| Tipo | Descrição |
|------|-----------|
| `http_request/response` | Todas as requisições HTTP |
| `authentication` | Tentativas de login/token |
| `security` | Eventos de segurança |
| `external_api` | Chamadas para OlympiaBank |
| `job_processing` | Processamento de imports |
| `webhook_sending` | Envio de webhooks |
| `performance_warning` | Requisições lentas (>5s) |

### ⚡ **Configuração do Log Level**

```bash
LOG_LEVEL=debug    # Desenvolvimento
LOG_LEVEL=info     # Produção (padrão)
LOG_LEVEL=warn     # Produção crítica
LOG_LEVEL=error    # Apenas erros
```

## 🧪 Desenvolvimento e Testes

### 🏃‍♂️ **Scripts Disponíveis**

```bash
# Desenvolvimento
npm run start:dev          # API em modo watch
npm run start:worker       # Worker em modo watch

# Build e Produção
npm run build             # Build TypeScript
npm run start:prod        # Produção

# Testes
npm run test              # Todos os testes
npm run test:unit         # Apenas testes unitários
npm run test:integration  # Testes de integração
npm run test:e2e          # Testes end-to-end
npm run test:cov          # Cobertura de testes

# Qualidade de Código
npm run lint              # ESLint
npm run format           # Prettier

# Banco de Dados
npm run migration:run     # Executar migrations
npm run migration:revert  # Reverter última migration
```

### ✅ **Cobertura de Testes**

```bash
# Resultado atual
Test Suites: 6 passed, 6 total
Tests: 82 passed, 82 total
Coverage: ~85% das linhas críticas
```

### 🔧 **Estrutura de Testes**

```
test/
├── unit/                 # Testes unitários (src/**/*.spec.ts)
├── integration/          # Testes de integração
├── e2e/                 # Testes end-to-end
├── fixtures/            # Arquivos de exemplo
└── mocks/              # Mocks para APIs externas
```

## 🚀 Deploy e Produção

### 🐳 **Docker em Produção**

```bash
# Build da imagem
docker build -t api-boletos-gateway .

# Deploy com compose
docker-compose -f docker-compose.prod.yml up -d

# Verificar logs
docker-compose logs -f api-boleto

# Executar migrations
docker-compose exec api-boleto npm run migration:run
```

### 🌐 **Nginx + SSL (Recomendado)**

```nginx
server {
    listen 443 ssl;
    server_name sua-api.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE precisa de configuração especial
    location /v1/imports/*/events {
        proxy_pass http://127.0.0.1:3001;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
}
```

### 📊 **Monitoramento de Produção**

**Métricas importantes para monitorar:**
- Taxa de erro das requisições HTTP
- Tempo de resposta da API OlympiaBank  
- Uso de memória e CPU
- Tamanho da fila Redis
- Taxa de sucesso dos boletos
- Logs de segurança críticos

**Alertas recomendados:**
- Rate limit atingido (429 errors)
- API OlympiaBank down (>50% errors)
- Fila Redis muito grande (>1000 jobs)
- Tempo de resposta alto (>10s)
- Tentativas de autenticação inválidas

## 🔒 Segurança

### 🛡️ **Boas Práticas Implementadas**

- ✅ **Autenticação via Bearer Token**
- ✅ **Rate limiting** por IP e cliente
- ✅ **Sanitização** de logs (dados sensíveis)
- ✅ **Validação rigorosa** de inputs
- ✅ **CORS configurável**
- ✅ **Logs de segurança** detalhados
- ✅ **Timeout** em APIs externas
- ✅ **Retry backoff** para evitar spam

### 🔐 **Headers de Segurança**

```javascript
// Configuração automática no NestJS
{
  \"Content-Security-Policy\": \"default-src 'self'\",
  \"X-Frame-Options\": \"DENY\",
  \"X-Content-Type-Options\": \"nosniff\",
  \"Referrer-Policy\": \"no-referrer\"
}
```

## 📋 Roadmap

### 🔄 **Próximas Versões**

- [ ] **Dashboard Web** para acompanhamento visual
- [ ] **Autenticação JWT** multi-tenant avançada  
- [ ] **Armazenamento S3** para arquivos grandes
- [ ] **Deduplicação inteligente** de boletos
- [ ] **Configuração dinâmica** de UTMs por cliente
- [ ] **Reprocessamento seletivo** de linhas com erro
- [ ] **API GraphQL** para queries complexas
- [ ] **Integração Slack/Discord** para alertas
- [ ] **Backup automático** de logs críticos

### 🔮 **Funcionalidades Avançadas**

- [ ] **Machine Learning** para detecção de fraudes
- [ ] **Cache inteligente** para boletos duplicados
- [ ] **Multi-region deployment**
- [ ] **Webhook retry** com dead letter queue
- [ ] **Rate limiting dinâmico** por cliente
- [ ] **Métricas business** customizadas

## 🤝 Contribuição

1. **Fork** o projeto
2. Crie uma **branch** (`git checkout -b feature/nova-funcionalidade`)
3. **Commit** suas mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um **Pull Request**

### 📝 **Padrões de Commit**

```bash
feat: nova funcionalidade
fix: correção de bug
docs: atualização de documentação
style: formatação de código
refactor: refatoração sem mudança de funcionalidade
test: adição ou correção de testes
chore: manutenção do código
```

## 📞 Suporte

- **GitHub Issues:** [Reportar problemas](https://github.com/seu-usuario/api-boletos-gateway/issues)
- **Documentação:** Swagger UI disponível em `/docs`
- **Logs:** Verifique `/app/logs/` em produção
- **Health Check:** `GET /v1/health` para diagnóstico

## 📄 Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<div align=\"center\">

**🎯 API Boletos Gateway**  
*Solução robusta e escalável para geração de boletos em massa*

[![GitHub](https://img.shields.io/badge/GitHub-projeto-black?logo=github)](https://github.com/seu-usuario/api-boletos-gateway)
[![Docker Hub](https://img.shields.io/badge/Docker-image-blue?logo=docker)](https://hub.docker.com/r/seu-usuario/api-boletos-gateway)

</div>
# API Boletos Gateway

API assíncrona para importação em massa e geração de boletos via OlympiaBank.

## Funcionalidades

- Upload de arquivos CSV/XLSX (até 2.000 linhas)
- Processamento assíncrono com BullMQ
- Integração com API OlympiaBank
- Geração de relatórios de sucesso e erro
- Webhook de notificação
- Server-Sent Events (SSE) para acompanhamento em tempo real
- Rate limiting e retry automático

## Requisitos

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker e Docker Compose (opcional)

## Instalação

### Com Docker

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/api-boletos-gateway.git
cd api-boletos-gateway

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Inicie os serviços
docker-compose up -d

# Execute as migrations
docker-compose exec api npm run typeorm migration:run
```

### Sem Docker

```bash
# Instale as dependências
npm install

# Configure PostgreSQL e Redis localmente
# Atualize o arquivo .env com as conexões

# Execute as migrations
npm run typeorm migration:run

# Inicie a aplicação
npm run start:dev

# Em outro terminal, inicie o worker
npm run start:worker
```

## Endpoints

### POST /v1/imports
Upload de arquivo para processamento.

**Headers:**
- `Authorization: Bearer <token>`

**Body (multipart/form-data):**
- `file`: Arquivo CSV ou XLSX
- `webhookUrl` (opcional): URL para callback

**Response:**
```json
{
  "importId": "uuid",
  "status": "queued",
  "maxRows": 2000
}
```

### GET /v1/imports/{id}
Consulta status da importação.

**Response:**
```json
{
  "id": "uuid",
  "status": "processing",
  "filename": "arquivo.csv",
  "createdAt": "2024-01-01T00:00:00Z",
  "stats": {
    "total": 100,
    "processed": 50,
    "success": 45,
    "error": 5
  },
  "links": {
    "results": "http://api/v1/imports/{id}/results.csv",
    "errors": "http://api/v1/imports/{id}/errors.csv"
  }
}
```

### GET /v1/imports/{id}/events
Server-Sent Events para acompanhamento em tempo real.

### GET /v1/imports/{id}/results.csv
Download do CSV com boletos gerados com sucesso.

### GET /v1/imports/{id}/errors.csv
Download do CSV com erros de processamento.

### GET /v1/health
Health check da aplicação.

## Formato do Arquivo

O arquivo CSV/XLSX deve conter as seguintes colunas:

| Coluna | Descrição | Formato | Exemplo |
|--------|-----------|---------|---------|
| amount | Valor em centavos ou reais | Número | 1500 ou 15.00 |
| name | Nome do cliente | Texto | João Silva |
| document | CPF ou CNPJ | Número | 11144477735 |
| telefone | Telefone com DDD | Número | 11987654321 |
| email | E-mail válido | E-mail | joao@example.com |
| vencimento | Data de vencimento | Data | 2024-12-31 ou 31/12/2024 |

## Autenticação

A API usa Bearer Token para autenticação. Configure os tokens no arquivo `.env`:

```
CLIENT_API_KEYS=cliente1:token1,cliente2:token2
```

Use o token no header:
```
Authorization: Bearer token1
```

## Configuração

Variáveis de ambiente disponíveis:

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| API_PORT | Porta da API | 8080 |
| POSTGRES_URL | URL de conexão PostgreSQL | - |
| REDIS_URL | URL de conexão Redis | - |
| OLYMPIA_BASE_URL | URL base da API OlympiaBank | - |
| OLYMPIA_TOKEN | Token de autenticação OlympiaBank | - |
| MAX_CONCURRENCY | Máximo de requisições simultâneas | 12 |
| MAX_RETRIES | Máximo de tentativas em caso de erro | 5 |
| FILE_RETENTION_DAYS | Dias para retenção de arquivos | 7 |

## Desenvolvimento

```bash
# Testes unitários
npm test

# Testes com coverage
npm run test:cov

# Linting
npm run lint

# Formatação
npm run format
```

## Deploy

O projeto está configurado para deploy com Docker em VPS Hostinger. O arquivo `docker-compose.yml` inclui todos os serviços necessários.

## Roadmap

- [ ] Interface web para upload e acompanhamento
- [ ] Autenticação JWT multi-tenant
- [ ] Armazenamento em S3
- [ ] Deduplicação de boletos
- [ ] Configuração dinâmica de UTMs
- [ ] Reprocessamento seletivo
- [ ] Dashboard de métricas
# Back‑end — Plano de Implementação (MVP)

## 1) Objetivo
Criar uma API assíncrona para receber **CSV/XLSX** (até **2.000 linhas**), processar e gerar **boletos** via **OlympiaBank**, com **relatórios CSV** e **webhook** ao concluir.

## 2) Escopo (MVP)
- Upload de arquivo (CSV/XLSX) com cabeçalho obrigatório: `amount, name, document, telefone, email, vencimento`.
- Processamento **assíncrono** com **BullMQ** (concorrência **12**) e **retry** para 5xx/429 (máx. **5**).
- Acompanhamento de status por **GET /v1/imports/{id}** e **SSE**.
- Download de **results.csv** e **errors.csv**.
- **Webhook** opcional ao finalizar.
- Persistência em **PostgreSQL**.
- Implantação em **Docker** na **VPS Hostinger**.

## 3) Arquitetura
- **API**: Node.js + NestJS/Express (REST + SSE).
- **Fila/Workers**: BullMQ (Redis) para fan‑out de linhas.
- **DB**: PostgreSQL (import, linhas, resultados).
- **Armazenamento de arquivo**: disco local (retensão 7 dias) *(S3 opcional em fase 2)*.
- **Rate limit adaptativo** e backoff exponencial.

## 4) Endpoints (Contrato)
- **POST** `/v1/imports` — multipart `file` (csv/xlsx); opcional `webhookUrl`.
  - **201** `{ importId, status:"queued", maxRows:2000 }`
- **GET** `/v1/imports/{id}` — status + stats + links de relatórios.
- **GET** `/v1/imports/{id}/events` — SSE: `queued|progress|completed|failed`.
- **GET** `/v1/imports/{id}/results.csv` — sucessos por linha.
- **GET** `/v1/imports/{id}/errors.csv` — erros por linha.
- **GET** `/health` — liveness/readiness.

**Autenticação**: `Authorization: Bearer <TOKEN_DO_CLIENTE>`.

## 5) Regras de validação (por linha)
- `document`: CPF (11) ou CNPJ (14), apenas dígitos.
- `telefone`: apenas dígitos; se faltar DDI, assume +55.
- `email`: formato válido.
- `amount`: aceita centavos (inteiro) **ou** reais decimal; converte para centavos.
- `vencimento`: `YYYY-MM-DD` ou `DD/MM/YYYY` *(no MVP não altera o boleto do upstream; apenas reportado)*.

Linhas inválidas → vão para **errors.csv** (sem retry). Erros transitórios no upstream → retry (até 5).

## 6) Integração com OlympiaBank
- **Endpoint**: `POST https://api.olympiabank.net/v1/boleto/`
- **Headers**: `Authorization: Bearer <OLYMPIA_TOKEN>`
- **Body**: mapeado a partir da linha importada:
  ```json
  {
    "amount": <centavos>,
    "client": { "name": "...", "document": "...", "telefone": "...", "email": "..." },
    "utms": { "utm_source": "import", "utm_medium": "batch", "utm_campaign": "bulk" },
    "product": { "name_product": "Boleto", "valor_product": "<valor decimal em reais>" },
    "split": { "user": "default", "value": "0" }
  }
  ```
- **Resposta**: salvar `idTransaction, boletoUrl, boletoCode, pdf, dueDate`.

## 7) Banco de Dados (modelo mínimo)
- `imports` (id, ownerId, originalFilename, status, totals: total/ok/erro, startedAt, finishedAt, webhookUrl)
- `import_rows` (id, importId, rowNumber, amount, name, document, telefone, email, vencimento, status, errorCode, errorMessage)
- `transactions` (id, importRowId, idTransaction, boletoUrl, boletoCode, pdf, dueDate, createdAt)

**Migrations**: TypeORM.

## 8) Observabilidade & Ops
- **Logs JSON** com PII mascarada (document, telefone, email parcialmente).
- **Métricas**: taxa de sucesso, latência, retries, 4xx/5xx.
- **Alertas** (fase 2): Slack/Telegram quando erro > X%.

## 9) Segurança
- API protegida por **Bearer Token** (estático por cliente) no MVP.
- Segredos em `.env`/secret manager; TLS via proxy (Nginx) na VPS.

## 10) Configuração (.env exemplo)
```
API_PORT=8080
API_BASE_URL=https://api.seudominio.com
API_TOKEN_ISSUER=internal
CLIENT_API_KEYS=clienteA:xxxxxxxx,clienteB:yyyyyyyy

REDIS_URL=redis://redis:6379
POSTGRES_URL=postgres://user:pass@postgres:5432/app

OLYMPIA_BASE_URL=https://api.olympiabank.net
OLYMPIA_TOKEN=***

MAX_CONCURRENCY=12
MAX_RETRIES=5
FILE_RETENTION_DAYS=7
```

## 11) Deploy (Docker Compose)
- Serviços: `api`, `worker`, `redis`, `postgres`, `nginx` (proxy).
- Pipeline: build → migrations → start (api & worker).

## 12) Testes
- **Unit**: validação/sanitização de campos.
- **Integração**: upload de amostra (20 linhas), geração de resultados/erros.
- **Contrato**: mocks do OlympiaBank + um teste real (homolog).

## 13) Definition of Done (MVP)
- Upload de arquivo até 2.000 linhas com cabeçalho → **OK**.
- `POST /v1/imports` retorna `importId` e enfileira linhas → **OK**.
- Worker com concorrência **12** + retries 5 e rate limit → **OK**.
- `GET /v1/imports/{id}` e **SSE** operacionais → **OK**.
- `results.csv` e `errors.csv` baixáveis → **OK**.
- Webhook dispara na conclusão (quando configurado) → **OK**.
- Logs e métricas básicas → **OK**.
- Deploy dockerizado funcional na VPS → **OK**.

## 14) Roadmap (Fase 2+)
- UI painel web (upload + progresso + histórico).
- RBAC/JWT multi‑tenant; rotação de API keys.
- Armazenamento S3, criptografia em repouso.
- Dedupe entre imports; idempotency por linha.
- Configuração dinâmica de UTMs/split por cliente.
- Reprocessamento seletivo de linhas com erro.
- Alertas operacionais (Slack/Telegram) e dashboard de métricas.


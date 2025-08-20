# Sistema de Logging Implementado

## Resumo

Foi implementado um sistema robusto de logging usando Winston, substituindo os logs básicos do console por um sistema estruturado e configurável adequado para produção.

## ✅ Funcionalidades Implementadas

### 1. **Winston Logger Service**
- Configuração por ambiente (desenvolvimento/produção)
- Logs estruturados em JSON para produção
- Logs coloridos e formatados para desenvolvimento
- Rotação automática de arquivos de log
- Separação de logs de erro em arquivos específicos

### 2. **Trace IDs**
- UUID único para cada requisição HTTP
- Rastreamento completo do fluxo de uma requisição
- Correlação entre logs de diferentes serviços

### 3. **Logging Interceptor Melhorado**
- Logs de entrada e saída de todas as requisições HTTP
- Sanitização de dados sensíveis (passwords, tokens, etc.)
- Detecção e alerta de requisições lentas (>5s)
- Logs estruturados com metadados completos

### 4. **Logs de Autenticação e Segurança**
- Tentativas de login bem-sucedidas e falhadas
- Detecção de tokens inválidos
- Logs de segurança por severidade (low, medium, high, critical)
- Rastreamento de IPs e User Agents suspeitos

### 5. **Logs de API Externa (OlympiaBank)**
- Logs detalhados de todas as chamadas para API externa
- Métricas de performance (tempo de resposta)
- Logs de rate limiting e ajuste automático
- Separação entre erros de cliente (4xx) e servidor (5xx)

### 6. **Logs de Processamento de Jobs**
- Rastreamento completo do ciclo de vida de importações
- Logs por batch de processamento
- Métricas de performance por lote
- Logs detalhados de retry e falhas permanentes

### 7. **Logs de Webhook**
- Tentativas de envio de webhook
- Success/failure tracking
- Métricas de tempo de resposta

### 8. **Logs de Infraestrutura**
- Configuração de banco de dados
- Configuração de Redis
- Inicialização de serviços
- Startup e shutdown da aplicação

## 📁 Estrutura de Arquivos de Log

Em produção, os logs são salvos em `/app/logs/`:

```
/app/logs/
├── application-2024-01-20.log    # Logs gerais da aplicação
├── application-2024-01-21.log
├── error-2024-01-20.log          # Logs de erro separados
├── error-2024-01-21.log
└── ...
```

### Configurações de Rotação:
- **Logs gerais**: Máximo 20MB por arquivo, mantidos por 14 dias
- **Logs de erro**: Máximo 20MB por arquivo, mantidos por 30 dias
- Rotação diária automática

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# Nível de log (error, warn, info, debug)
LOG_LEVEL=info

# Ambiente (production, development)
NODE_ENV=production
```

### Tipos de Log Estruturados

Todos os logs incluem:
- `timestamp`: ISO timestamp
- `level`: Nível do log (error, warn, info, debug)
- `message`: Mensagem principal
- `service`: Nome do serviço (api-boletos-gateway)
- `environment`: Ambiente (production/development)
- `type`: Tipo específico do log para filtragem

Exemplos de tipos implementados:
- `http_request`, `http_response`
- `authentication`, `security`
- `external_api`, `database_operation`
- `job_processing`, `webhook_sending`
- `server_startup`, `server_ready`

## 🔍 Logs Críticos para Produção

### 1. **Monitoramento de Performance**
```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "level": "warn",
  "message": "Slow request detected",
  "type": "performance_warning",
  "traceId": "uuid-123",
  "method": "POST",
  "url": "/v1/imports",
  "responseTime": 8500
}
```

### 2. **Segurança**
```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "level": "error",
  "message": "Security Event",
  "type": "security",
  "event": "Authentication attempt with invalid API key",
  "severity": "high",
  "ip": "192.168.1.100",
  "userAgent": "curl/7.68.0"
}
```

### 3. **API Externa**
```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "level": "error",
  "message": "External API Call",
  "type": "external_api",
  "service": "OlympiaBank",
  "method": "POST",
  "statusCode": 500,
  "duration": 30000,
  "success": false
}
```

### 4. **Processamento de Jobs**
```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "level": "info",
  "message": "Job Processing",
  "type": "job_processing",
  "jobId": "123",
  "jobType": "process-import",
  "status": "completed",
  "duration": 45000,
  "metadata": {
    "importId": "uuid-456",
    "totalRows": 1000,
    "successRows": 985,
    "errorRows": 15
  }
}
```

## 🚀 Benefícios em Produção

1. **Debugging Eficiente**: Trace IDs permitem rastrear requisições complexas
2. **Monitoramento Proativo**: Alertas automáticos para requisições lentas
3. **Segurança**: Rastreamento detalhado de tentativas de acesso
4. **Performance**: Métricas de APIs externas e processamento interno
5. **Compliance**: Logs estruturados facilitam auditoria
6. **Escalabilidade**: Logs em arquivo com rotação automática

## 📊 Métricas Disponíveis

- Taxa de sucesso/falha de autenticação
- Tempo de resposta de APIs externas
- Performance de processamento de importações
- Taxa de sucesso de webhooks
- Detecção de padrões de ataques

## 🔧 Próximos Passos Recomendados

1. **Integração com ELK Stack** ou similar para análise
2. **Alertas automatizados** baseados em logs críticos
3. **Dashboard de métricas** em tempo real
4. **Backup automático** de logs para storage externo
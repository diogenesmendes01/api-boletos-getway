#!/bin/bash

set -euo pipefail

echo "================================================"
echo "🚀 DEPLOY PRODUÇÃO - API BOLETOS GATEWAY"
echo "================================================"

# Configurações
PROJECT_DIR="${HOME}/projetos/api-boleto"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${PROJECT_DIR}/backups/$(date +%Y%m%d_%H%M%S)"

echo "📁 Diretório do projeto: ${PROJECT_DIR}"
echo "📄 Arquivo compose: ${COMPOSE_FILE}"

# Verificar se o compose existe
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "❌ Arquivo ${COMPOSE_FILE} não encontrado!"
    exit 1
fi

# Criar backup dos logs atuais
echo "💾 Criando backup dos logs..."
mkdir -p "${BACKUP_DIR}"
if [ -d "${PROJECT_DIR}/logs" ]; then
    cp -r "${PROJECT_DIR}/logs" "${BACKUP_DIR}/" || true
fi

# Parar e remover containers existentes
echo "🛑 Parando containers existentes..."
cd "${PROJECT_DIR}"
docker compose -f "${COMPOSE_FILE}" down --remove-orphans || true

# Limpeza completa
echo "🧹 Limpeza completa..."
docker rm -f api-boleto-olympia 2>/dev/null || true
docker rm -f redis-boleto 2>/dev/null || true
docker container prune -f || true
docker image prune -f || true
docker volume prune -f || true

# Verificar se o postgres-olympia está rodando
echo "🔍 Verificando postgres-olympia..."
if ! docker ps --format "{{.Names}}" | grep -q "postgres-olympia"; then
    echo "❌ Container postgres-olympia não está rodando!"
    echo "📋 Containers ativos:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    exit 1
fi

# Verificar conectividade com o banco
echo "🔌 Testando conectividade com o banco..."
if ! docker run --rm --network proxy-network postgres:15-alpine psql "postgresql://olympia_app:V/aMMGypweFPSlGivTdcaC44zzEZDfuv@postgres-olympia:5432/boleto_db" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ Não foi possível conectar ao banco postgres-olympia!"
    exit 1
fi
echo "✅ Conectividade com o banco OK!"

# Garantir rede
echo "🔗 Configurando rede..."
docker network create proxy-network 2>/dev/null || true

# Pull das imagens
echo "📦 Fazendo pull das imagens..."
docker compose -f "${COMPOSE_FILE}" pull

# Subir serviços
echo "🚀 Subindo serviços..."
docker compose -f "${COMPOSE_FILE}" up -d --force-recreate --remove-orphans

# Aguardar inicialização
echo "⏳ Aguardando inicialização (45s)..."
sleep 45

# Verificar status dos containers
echo "🔍 Verificando status dos containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Verificar se os containers estão rodando
echo "🏥 Verificando saúde dos containers..."
if ! docker ps --format "{{.Names}}" | grep -q "api-boleto-olympia"; then
    echo "❌ Container api-boleto-olympia não está rodando!"
    echo "📋 Logs do container:"
    docker logs --tail 100 api-boleto-olympia || true
    exit 1
fi

if ! docker ps --format "{{.Names}}" | grep -q "redis-boleto"; then
    echo "❌ Container redis-boleto não está rodando!"
    exit 1
fi

# Testar endpoint de saúde
echo "🏥 Testando endpoint de saúde..."
if ! curl -f -s "http://localhost:3001/v1/health" >/dev/null; then
    echo "❌ Endpoint de saúde não está respondendo!"
    echo "📋 Logs do api-boleto-olympia:"
    docker logs --tail 100 api-boleto-olympia || true
    exit 1
fi

echo "📋 Últimos logs do api-boleto-olympia:"
docker logs --tail 50 api-boleto-olympia || true

echo "✅ Deploy concluído com sucesso!"
echo "🌐 API disponível em: http://localhost:3001"
echo "📊 Health check: http://localhost:3001/v1/health"

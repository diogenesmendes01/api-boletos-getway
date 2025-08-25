#!/bin/bash

echo "🔍 Verificando configuração do ambiente de PRODUÇÃO..."
echo "====================================================="

# Configurações da VPS
PROJECT_DIR="/opt/api-boletos-getway"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

echo "📁 Diretório do projeto: ${PROJECT_DIR}"
echo "📄 Arquivo compose: ${COMPOSE_FILE}"
echo "🏠 HOME do usuário: ${HOME}"
echo "👤 Usuário atual: $(whoami)"

# Verificar se o diretório existe
if [ ! -d "${PROJECT_DIR}" ]; then
    echo "❌ Diretório ${PROJECT_DIR} não existe!"
    exit 1
fi

# Verificar se o compose existe
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "❌ Arquivo ${COMPOSE_FILE} não encontrado!"
    exit 1
fi

echo ""

# Verificar docker-compose de produção
echo "🐳 Configuração Docker de Produção:"
if [ -f "${COMPOSE_FILE}" ]; then
    echo "✅ docker-compose.prod.yml encontrado"
    echo "   NODE_ENV: $(grep NODE_ENV "${COMPOSE_FILE}" | head -1 | cut -d'=' -f2 | tr -d ' "' || echo 'não definido')"
    echo "   DB_HOST: $(grep DB_HOST "${COMPOSE_FILE}" | head -1 | cut -d'=' -f2 | tr -d ' "' || echo 'não definido')"
    echo "   DB_DATABASE: $(grep DB_DATABASE "${COMPOSE_FILE}" | head -1 | cut -d'=' -f2 | tr -d ' "' || echo 'não definido')"
    echo "   REDIS_URL: $(grep REDIS_URL "${COMPOSE_FILE}" | head -1 | cut -d'=' -f2 | tr -d ' "' || echo 'não definido')"
else
    echo "❌ docker-compose.prod.yml não encontrado"
fi

echo ""

# Verificar containers Docker
echo "🐳 Status dos Containers:"
if docker ps --format "{{.Names}}" | grep -q "api-boleto-olympia"; then
    echo "✅ Container api-boleto-olympia está rodando"
    echo "   Status: $(docker ps --format '{{.Status}}' --filter name=api-boleto-olympia)"
    echo "   Porta: $(docker ps --format '{{.Ports}}' --filter name=api-boleto-olympia)"
else
    echo "❌ Container api-boleto-olympia não está rodando"
fi

if docker ps --format "{{.Names}}" | grep -q "redis-boleto"; then
    echo "✅ Container redis-boleto está rodando"
    echo "   Status: $(docker ps --format '{{.Status}}' --filter name=redis-boleto)"
else
    echo "❌ Container redis-boleto não está rodando"
fi

echo ""

# Verificar se a aplicação está respondendo
echo "🚀 Status da Aplicação:"
if curl -s http://localhost:3001/v1/health > /dev/null 2>&1; then
    echo "✅ API rodando em http://localhost:3001"
    echo "📖 Health check: http://localhost:3001/v1/health"
    echo "📖 Swagger disponível em: http://localhost:3001/docs"
else
    echo "❌ API não está respondendo em http://localhost:3001"
    echo "📋 Últimos logs do container:"
    docker logs --tail 20 api-boleto-olympia 2>/dev/null || echo "   Não foi possível acessar os logs"
fi

echo ""

# Verificar conectividade de rede
echo "🔌 Testando Conectividade:"
if docker network ls | grep -q "proxy-network"; then
    echo "✅ Rede proxy-network existe"
    
    # Testar conectividade com postgres
    if docker ps --format "{{.Names}}" | grep -q "postgres-olympia"; then
        echo "🔍 Testando conectividade com postgres-olympia..."
        if docker run --rm --network proxy-network postgres:15-alpine psql "postgresql://olympia_app:V/aMMGypweFPSlGivTdcaC44zzEZDfuv@postgres-olympia:5432/boleto_db" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "✅ Conectividade com postgres OK"
        else
            echo "❌ Falha na conectividade com postgres"
        fi
    else
        echo "⚠️  Container postgres-olympia não encontrado"
    fi
else
    echo "❌ Rede proxy-network não existe"
fi

echo ""
echo "🔧 Para resolver problemas:"
echo "   1. Use ./scripts/debug-prod.sh para debug completo"
echo "   2. Use ./scripts/deploy-prod.sh para redeploy"
echo "   3. Verifique logs: docker logs -f api-boleto-olympia"
echo "   4. Verifique rede: docker network ls"

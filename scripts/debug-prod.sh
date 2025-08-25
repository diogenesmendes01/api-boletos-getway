#!/bin/bash

set -euo pipefail

echo "================================================"
echo "🔍 DEBUG PRODUÇÃO - API BOLETOS GATEWAY"
echo "================================================"

# Configurações
PROJECT_DIR="${HOME}/projetos/api-boleto"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

echo "📁 Diretório do projeto: ${PROJECT_DIR}"
echo "📄 Arquivo compose: ${COMPOSE_FILE}"

# Verificar se o compose existe
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "❌ Arquivo ${COMPOSE_FILE} não encontrado!"
    exit 1
fi

# Status geral do Docker
echo "🐳 Status geral do Docker:"
docker system df

echo ""
echo "📋 Containers ativos:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"

echo ""
echo "📋 Todos os containers (incluindo parados):"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"

echo ""
echo "🔗 Redes Docker:"
docker network ls

echo ""
echo "📦 Imagens relacionadas:"
docker images | grep -E "(api-boletos|redis)" || echo "Nenhuma imagem relacionada encontrada"

# Verificar logs dos containers
echo ""
echo "📋 Logs do api-boleto-olympia (últimas 50 linhas):"
if docker ps --format "{{.Names}}" | grep -q "api-boleto-olympia"; then
    docker logs --tail 50 api-boleto-olympia
else
    echo "Container api-boleto-olympia não está rodando"
fi

echo ""
echo "📋 Logs do redis-boleto (últimas 20 linhas):"
if docker ps --format "{{.Names}}" | grep -q "redis-boleto"; then
    docker logs --tail 20 redis-boleto
else
    echo "Container redis-boleto não está rodando"
fi

# Verificar conectividade de rede
echo ""
echo "🔌 Testando conectividade de rede:"
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

# Verificar recursos do sistema
echo ""
echo "💻 Recursos do sistema:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memória: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Disco: $(df -h / | awk 'NR==2{print $5}')"

# Verificar portas em uso
echo ""
echo "🔌 Portas em uso:"
netstat -tlnp 2>/dev/null | grep -E ":(3001|5432|6379)" || echo "Nenhuma porta relevante encontrada"

echo ""
echo "================================================"
echo "🔍 DEBUG CONCLUÍDO"
echo "================================================"

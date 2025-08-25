#!/bin/bash

set -euo pipefail

echo "🔄 INICIANDO ROLLBACK AUTOMÁTICO"
echo "================================================"

PROJECT_DIR="/opt/api-boletos-getway"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Função para log estruturado
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Função para verificar se o rollback foi bem-sucedido
verify_rollback() {
    local max_attempts=12
    local attempt=0
    
    log "🔍 Verificando se o rollback foi bem-sucedido..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s "http://localhost:3001/v1/health" > /dev/null; then
            log "✅ Rollback bem-sucedido! Aplicação está saudável"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log "⏳ Tentativa $attempt/$max_attempts - Aguardando aplicação..."
        sleep 5
    done
    
    log "❌ Rollback falhou - aplicação não está respondendo"
    return 1
}

# 1. Parar a aplicação atual
log "🛑 Parando aplicação atual..."
cd "${PROJECT_DIR}"
docker compose -f "${COMPOSE_FILE}" down --remove-orphans || true

# 2. Encontrar a versão anterior mais recente
log "🔍 Procurando versão anterior para rollback..."
if [ -d "${BACKUP_DIR}" ]; then
    PREVIOUS_VERSION=$(find "${BACKUP_DIR}" -name "previous_version.txt" -exec cat {} \; | tail -1)
    if [ -n "${PREVIOUS_VERSION}" ]; then
        log "📦 Versão anterior encontrada: ${PREVIOUS_VERSION}"
    else
        log "⚠️ Nenhuma versão anterior encontrada, usando latest"
        PREVIOUS_VERSION="latest"
    fi
else
    log "⚠️ Diretório de backup não encontrado, usando latest"
    PREVIOUS_VERSION="latest"
fi

# 3. Fazer pull da versão anterior
log "📥 Fazendo pull da versão anterior: ${PREVIOUS_VERSION}"
docker pull "ghcr.io/diogenesmendes01/api-boletos-getway:${PREVIOUS_VERSION}" || {
    log "❌ Falha ao fazer pull da versão anterior, tentando latest"
    PREVIOUS_VERSION="latest"
    docker pull "ghcr.io/diogenesmendes01/api-boletos-getway:${PREVIOUS_VERSION}"
}

# 4. Atualizar docker-compose com a versão anterior
log "🔧 Atualizando docker-compose com versão anterior..."
sed -i "s|image: ghcr.io/diogenesmendes01/api-boletos-getway:.*|image: ghcr.io/diogenesmendes01/api-boletos-getway:${PREVIOUS_VERSION}|" "${COMPOSE_FILE}"

# 5. Iniciar serviços com versão anterior
log "🚀 Iniciando serviços com versão anterior..."
docker compose -f "${COMPOSE_FILE}" up -d --force-recreate

# 6. Aguardar inicialização
log "⏳ Aguardando inicialização dos serviços..."
./scripts/wait-for-it.sh localhost:3001 -t 120 -- echo "✅ API está respondendo" || {
    log "❌ Timeout aguardando API"
    exit 1
}

# 7. Verificar se o rollback foi bem-sucedido
if verify_rollback; then
    log "🎉 ROLLBACK CONCLUÍDO COM SUCESSO!"
    log "📊 Status dos containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    
    # Notificar sucesso (pode ser integrado com webhook/slack/etc)
    log "📢 Rollback bem-sucedido para versão: ${PREVIOUS_VERSION}"
else
    log "💥 ROLLBACK FALHOU!"
    log "📋 Logs do container:"
    docker logs --tail 100 api-boleto-olympia || true
    
    # Última tentativa: reiniciar tudo
    log "🔄 Última tentativa: reiniciando todos os serviços..."
    docker compose -f "${COMPOSE_FILE}" restart
    
    if verify_rollback; then
        log "✅ Rollback recuperado após reinicialização"
    else
        log "❌ Rollback falhou completamente - intervenção manual necessária"
        exit 1
    fi
fi

echo "================================================"
echo "🔄 ROLLBACK FINALIZADO"
echo "📦 Versão atual: ${PREVIOUS_VERSION}"
echo "🌐 Health check: http://localhost:3001/v1/health"

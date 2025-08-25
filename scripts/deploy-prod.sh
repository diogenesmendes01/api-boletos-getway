#!/bin/bash

set -euo pipefail

echo "================================================"
echo "🚀 DEPLOY PRODUÇÃO - API BOLETOS GATEWAY"
echo "================================================"

# Carregar configuração centralizada
source "$(dirname "$0")/config.sh"

# Validar configuração
validate_config || {
    echo "❌ Configuração inválida, abortando deploy"
    exit 1
}

# Criar backup automático
BACKUP_PATH=$(create_backup)

echo "📁 Diretório do projeto: ${PROJECT_DIR}"
echo "📄 Arquivo compose: ${COMPOSE_FILE}"
echo "🏠 HOME do usuário: ${HOME}"
echo "👤 Usuário atual: $(whoami)"

# Verificar se o diretório existe
if [ ! -d "${PROJECT_DIR}" ]; then
    log "ERROR" "Diretório ${PROJECT_DIR} não existe!"
    log "INFO" "🔧 Criando diretório..."
    sudo mkdir -p "${PROJECT_DIR}" || { 
        log "ERROR" "Não foi possível criar o diretório"
        exit 1
    }
    sudo chown $(whoami):$(whoami) "${PROJECT_DIR}" || log "WARN" "Não foi possível alterar permissões"
fi

# Verificar se o compose existe
if [ ! -f "${COMPOSE_FILE}" ]; then
    log "ERROR" "Arquivo ${COMPOSE_FILE} não encontrado!"
    log "ERROR" "Arquivo deve ser enviado pelo workflow antes do deploy"
    exit 1
fi

# Verificar permissões do diretório
log "INFO" "🔐 Verificando permissões do diretório..."
ls -la "${PROJECT_DIR}" || log "WARN" "Não foi possível listar o diretório"

# Parar e remover containers existentes
log "INFO" "🛑 Parando containers existentes..."
cd "${PROJECT_DIR}"
docker compose -f "${COMPOSE_FILE}" down --remove-orphans || true

# Limpeza inteligente (preservar volumes e dados importantes)
log "INFO" "🧹 Limpeza inteligente..."
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
docker rm -f "${REDIS_CONTAINER}" 2>/dev/null || true
cleanup_resources

            # Verificar se o postgres-olympia está rodando
            echo "🔍 Verificando postgres-olympia..."
            if ! docker ps --format "{{.Names}}" | grep -q "postgres-olympia"; then
                echo "⚠️  Container postgres-olympia não está rodando!"
                echo "📋 Containers ativos:"
                docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
                echo "🔧 Continuando deploy - banco pode estar em outro servidor..."
            else
                echo "✅ Container postgres-olympia encontrado"
            fi

            # Verificar conectividade com o banco
            echo "🔌 Testando conectividade com o banco..."
            if ! docker run --rm --network proxy-network postgres:15-alpine psql "postgresql://olympia_app:V/aMMGypweFPSlGivTdcaC44zzEZDfuv@postgres-olympia:5432/boleto_db" -c "SELECT 1;" >/dev/null 2>&1; then
                echo "⚠️  Não foi possível conectar ao banco postgres-olympia!"
                echo "🔧 Continuando deploy - banco pode estar iniciando..."
                echo "📋 Verifique se o container postgres-olympia está rodando:"
                echo "   docker ps | grep postgres-olympia"
            else
                echo "✅ Conectividade com o banco OK!"
            fi

# Garantir rede
log "INFO" "🔗 Configurando rede..."
docker network create proxy-network 2>/dev/null || true

# Pull inteligente das imagens (só se houver mudanças)
log "INFO" "📦 Verificando se há novas imagens..."
CURRENT_IMAGE=$(docker inspect "${CONTAINER_NAME}" --format='{{.Config.Image}}' 2>/dev/null || echo "")
NEW_IMAGE="${REGISTRY}/${IMAGE_NAME}:${DEPLOY_VERSION:-latest}"

if [ "$CURRENT_IMAGE" != "$NEW_IMAGE" ]; then
    log "INFO" "🆕 Nova imagem detectada, fazendo pull..."
    docker compose -f "${COMPOSE_FILE}" pull
else
    log "INFO" "⏩ Imagem já está atualizada, pulando pull"
fi

# Subir serviços
log "INFO" "🚀 Subindo serviços..."
docker compose -f "${COMPOSE_FILE}" up -d --force-recreate --remove-orphans

# Aguardar inicialização usando wait-for-it
log "INFO" "⏳ Aguardando inicialização dos serviços..."
wait_for_service "localhost" "${API_PORT}" "${HEALTH_CHECK_TIMEOUT}" "API"
wait_for_service "localhost" "${REDIS_PORT}" "${REDIS_TIMEOUT}" "Redis"

# Verificar status dos containers
log "INFO" "🔍 Verificando status dos containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

            # Verificar se os containers estão rodando
            log "INFO" "🏥 Verificando saúde dos containers..."
            if ! is_container_running "${CONTAINER_NAME}"; then
                log "ERROR" "Container ${CONTAINER_NAME} não está rodando!"
                log "INFO" "📋 Logs do container:"
                docker logs --tail 100 "${CONTAINER_NAME}" || true
                log "INFO" "🔧 Tentando iniciar novamente..."
                docker compose -f "${COMPOSE_FILE}" up -d api-boleto
                sleep 30
                
                # Verificar novamente
                if ! is_container_running "${CONTAINER_NAME}"; then
                    log "ERROR" "Falha ao iniciar ${CONTAINER_NAME}!"
                    log "ERROR" "Container não conseguiu iniciar, abortando deploy"
                    exit 1
                fi
            fi

            if ! is_container_running "${REDIS_CONTAINER}"; then
                log "ERROR" "Container ${REDIS_CONTAINER} não está rodando!"
                log "INFO" "🔧 Tentando iniciar novamente..."
                docker compose -f "${COMPOSE_FILE}" up -d redis-boleto
                sleep 10
                
                # Verificar novamente
                if ! is_container_running "${REDIS_CONTAINER}"; then
                    log "ERROR" "Falha ao iniciar ${REDIS_CONTAINER}!"
                    log "ERROR" "Container não conseguiu iniciar, abortando deploy"
                    exit 1
                fi
            fi

# Testar endpoint de saúde
log "INFO" "🏥 Testando endpoint de saúde..."
log "INFO" "⏳ Aguardando mais tempo para aplicação inicializar..."
sleep 15

if ! curl -f -s "${HEALTH_ENDPOINT}" >/dev/null; then
    log "WARN" "Endpoint de saúde não está respondendo ainda!"
    log "INFO" "📋 Logs do container:"
    docker logs --tail 100 "${CONTAINER_NAME}" || true
    log "WARN" "A aplicação pode estar ainda inicializando..."
    log "INFO" "📋 Verifique manualmente em alguns minutos:"
    log "INFO" "   curl ${HEALTH_ENDPOINT}"
else
    log "SUCCESS" "Endpoint de saúde respondendo!"
fi

log "INFO" "📋 Últimos logs do ${CONTAINER_NAME}:"
docker logs --tail 50 "${CONTAINER_NAME}" || true

log "SUCCESS" "Deploy concluído com sucesso!"
log "INFO" "🌐 API disponível em: http://localhost:${API_PORT}"
log "INFO" "📊 Health check: ${HEALTH_ENDPOINT}"

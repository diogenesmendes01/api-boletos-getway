#!/bin/bash

# ================================================
# CONFIGURAÇÃO CENTRALIZADA - API BOLETOS GATEWAY
# ================================================

# Diretórios
export PROJECT_DIR="/opt/api-boletos-getway"
export SCRIPTS_DIR="${PROJECT_DIR}/scripts"
export BACKUP_DIR="${PROJECT_DIR}/backups"
export LOGS_DIR="${PROJECT_DIR}/logs"
export UPLOADS_DIR="${PROJECT_DIR}/uploads"

# Arquivos
export COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
export ENV_FILE="${PROJECT_DIR}/.env.production"

# Docker
export REGISTRY="ghcr.io"
export IMAGE_NAME="diogenesmendes01/api-boletos-getway"
export CONTAINER_NAME="api-boleto-olympia"
export REDIS_CONTAINER="redis-boleto"

# Portas
export API_PORT="3001"
export REDIS_PORT="6379"
export HEALTH_ENDPOINT="http://localhost:${API_PORT}/v1/health"

# Timeouts
export HEALTH_CHECK_TIMEOUT=120
export REDIS_TIMEOUT=60
export DEPLOY_TIMEOUT=300

# Retry
export MAX_RETRIES=5
export RETRY_DELAY=10

# Função para validar configuração
validate_config() {
    local errors=0
    
    # Verificar diretórios obrigatórios
    if [ ! -d "${PROJECT_DIR}" ]; then
        echo "❌ Diretório do projeto não existe: ${PROJECT_DIR}"
        errors=$((errors + 1))
    fi
    
    if [ ! -d "${SCRIPTS_DIR}" ]; then
        echo "❌ Diretório de scripts não existe: ${SCRIPTS_DIR}"
        errors=$((errors + 1))
    fi
    
    # Verificar arquivos obrigatórios
    if [ ! -f "${COMPOSE_FILE}" ]; then
        echo "❌ Arquivo docker-compose não encontrado: ${COMPOSE_FILE}"
        errors=$((errors + 1))
    fi
    
    # Verificar variáveis de ambiente
    if [ -z "${DEPLOY_VERSION:-}" ]; then
        echo "⚠️ DEPLOY_VERSION não definida, usando latest"
        export DEPLOY_VERSION="latest"
    fi
    
    if [ $errors -eq 0 ]; then
        echo "✅ Configuração validada com sucesso"
        return 0
    else
        echo "❌ Configuração inválida: $errors erro(s)"
        return 1
    fi
}

# Função para log estruturado
log() {
    local level="${1:-INFO}"
    local message="${2:-}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "${level}" in
        "INFO"|"info")
            echo "[${timestamp}] ℹ️  ${message}"
            ;;
        "WARN"|"warn")
            echo "[${timestamp}] ⚠️  ${message}"
            ;;
        "ERROR"|"error")
            echo "[${timestamp}] ❌ ${message}"
            ;;
        "SUCCESS"|"success")
            echo "[${timestamp}] ✅ ${message}"
            ;;
        *)
            echo "[${timestamp}] ${level}: ${message}"
            ;;
    esac
}

# Função para verificar se o container está rodando
is_container_running() {
    local container_name="$1"
    docker ps --format "{{.Names}}" | grep -q "^${container_name}$"
}

# Função para aguardar serviço estar disponível
wait_for_service() {
    local host="$1"
    local port="$2"
    local timeout="${3:-60}"
    local service_name="${4:-serviço}"
    
    log "INFO" "⏳ Aguardando ${service_name} em ${host}:${port} (timeout: ${timeout}s)"
    
    if [ -f "${SCRIPTS_DIR}/wait-for-it.sh" ]; then
        "${SCRIPTS_DIR}/wait-for-it.sh" "${host}:${port}" -t "${timeout}" -- echo "✅ ${service_name} está respondendo"
    else
        # Fallback para wait-for-it se o script não existir
        timeout "${timeout}" bash -c "until nc -z ${host} ${port}; do sleep 1; done" || {
            log "ERROR" "Timeout aguardando ${service_name}"
            return 1
        }
        log "SUCCESS" "${service_name} está respondendo"
    fi
}

# Função para backup automático
create_backup() {
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    log "INFO" "💾 Criando backup: ${backup_name}"
    
    mkdir -p "${backup_path}"
    
    # Backup da versão atual
    if is_container_running "${CONTAINER_NAME}"; then
        docker inspect "${CONTAINER_NAME}" --format='{{.Config.Image}}' > "${backup_path}/previous_version.txt" 2>/dev/null || true
        docker logs --tail 1000 "${CONTAINER_NAME}" > "${backup_path}/last_logs.txt" 2>&1 || true
    fi
    
    # Backup do docker-compose
    if [ -f "${COMPOSE_FILE}" ]; then
        cp "${COMPOSE_FILE}" "${backup_path}/"
    fi
    
    # Backup das variáveis de ambiente
    if [ -f "${ENV_FILE}" ]; then
        cp "${ENV_FILE}" "${backup_path}/"
    fi
    
    log "SUCCESS" "Backup criado em: ${backup_path}"
    echo "${backup_path}"
}

# Função para limpeza inteligente
cleanup_resources() {
    log "INFO" "🧹 Executando limpeza inteligente..."
    
    # Remover containers parados
    docker container prune -f
    
    # Remover imagens não utilizadas (preservar volumes)
    docker image prune -f
    
    # Limpar logs antigos (mais de 7 dias)
    if [ -d "${LOGS_DIR}" ]; then
        find "${LOGS_DIR}" -type f -mtime +7 -delete 2>/dev/null || true
    fi
    
    # Limpar backups antigos (mais de 30 dias)
    if [ -d "${BACKUP_DIR}" ]; then
        find "${BACKUP_DIR}" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
    fi
    
    log "SUCCESS" "Limpeza concluída"
}

# Exportar funções para uso em outros scripts
export -f validate_config
export -f log
export -f is_container_running
export -f wait_for_service
export -f create_backup
export -f cleanup_resources

# Validar configuração ao carregar
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    validate_config
fi

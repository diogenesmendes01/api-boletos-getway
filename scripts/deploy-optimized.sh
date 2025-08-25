#!/bin/bash

set -euo pipefail

# Carregar configuração centralizada
source "$(dirname "$0")/config.sh"

# Função para deploy otimizado
deploy_application() {
    local deploy_version="${1:-latest}"
    local force_redeploy="${2:-false}"
    
    log "INFO" "🚀 Iniciando deploy da versão: ${deploy_version}"
    
    # 1. Validação pré-deploy
    validate_pre_deploy || {
        log "ERROR" "Validação pré-deploy falhou"
        return 1
    }
    
    # 2. Backup automático
    local backup_path=$(create_backup)
    log "INFO" "💾 Backup criado em: ${backup_path}"
    
    # 3. Parar aplicação atual
    stop_current_application
    
    # 4. Pull inteligente de imagens
    pull_images_if_needed "${deploy_version}" "${force_redeploy}"
    
    # 5. Atualizar configuração
    update_deployment_config "${deploy_version}"
    
    # 6. Iniciar nova versão
    start_new_version
    
    # 7. Health check
    if perform_health_check; then
        log "SUCCESS" "🎉 Deploy concluído com sucesso!"
        cleanup_old_resources
        return 0
    else
        log "ERROR" "💥 Deploy falhou, iniciando rollback..."
        perform_rollback "${backup_path}"
        return 1
    fi
}

# Função para validação pré-deploy
validate_pre_deploy() {
    log "INFO" "🔍 Validando ambiente pré-deploy..."
    
    # Verificar se o diretório existe
    if [ ! -d "${PROJECT_DIR}" ]; then
        log "ERROR" "Diretório do projeto não existe: ${PROJECT_DIR}"
        return 1
    fi
    
    # Verificar se o docker-compose existe
    if [ ! -f "${COMPOSE_FILE}" ]; then
        log "ERROR" "Arquivo docker-compose não encontrado: ${COMPOSE_FILE}"
        return 1
    fi
    
    # Verificar se o Docker está rodando
    if ! docker info >/dev/null 2>&1; then
        log "ERROR" "Docker não está rodando"
        return 1
    fi
    
    # Verificar espaço em disco
    local available_space=$(df "${PROJECT_DIR}" | awk 'NR==2 {print $4}')
    if [ "${available_space}" -lt 1048576 ]; then  # 1GB em KB
        log "WARN" "Pouco espaço em disco disponível: ${available_space}KB"
    fi
    
    log "SUCCESS" "✅ Validação pré-deploy concluída"
    return 0
}

# Função para parar aplicação atual
stop_current_application() {
    log "INFO" "🛑 Parando aplicação atual..."
    
    cd "${PROJECT_DIR}"
    
    # Parar containers graciosamente
    if docker compose -f "${COMPOSE_FILE}" ps -q | grep -q .; then
        docker compose -f "${COMPOSE_FILE}" down --remove-orphans --timeout 30
    fi
    
    # Limpeza inteligente
    cleanup_resources
    
    log "SUCCESS" "✅ Aplicação atual parada"
}

# Função para pull inteligente de imagens
pull_images_if_needed() {
    local deploy_version="$1"
    local force_redeploy="$2"
    
    log "INFO" "📦 Verificando necessidade de pull de imagens..."
    
    local current_image=$(docker inspect "${CONTAINER_NAME}" --format='{{.Config.Image}}' 2>/dev/null || echo "")
    local new_image="${REGISTRY}/${IMAGE_NAME}:${deploy_version}"
    
    if [ "$force_redeploy" = "true" ] || [ "$CURRENT_IMAGE" != "$NEW_IMAGE" ]; then
        log "INFO" "🆕 Nova imagem detectada ou force redeploy, fazendo pull..."
        
        # Login no registry se necessário
        if [ -n "${GITHUB_TOKEN:-}" ]; then
            echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_ACTOR:-}" --password-stdin
        fi
        
        docker compose -f "${COMPOSE_FILE}" pull
        
        log "SUCCESS" "✅ Pull de imagens concluído"
    else
        log "INFO" "⏩ Imagem já está atualizada, pulando pull"
    fi
}

# Função para atualizar configuração de deploy
update_deployment_config() {
    local deploy_version="$1"
    
    log "INFO" "🔧 Atualizando configuração de deploy..."
    
    # Atualizar versão no docker-compose se necessário
    if [ -f "${COMPOSE_FILE}" ]; then
        sed -i "s|image: ${REGISTRY}/${IMAGE_NAME}:.*|image: ${REGISTRY}/${IMAGE_NAME}:${deploy_version}|" "${COMPOSE_FILE}"
        log "INFO" "✅ Versão atualizada no docker-compose"
    fi
    
    # Garantir rede
    docker network create proxy-network 2>/dev/null || true
}

# Função para iniciar nova versão
start_new_version() {
    log "INFO" "🚀 Iniciando nova versão..."
    
    cd "${PROJECT_DIR}"
    
    # Subir serviços
    docker compose -f "${COMPOSE_FILE}" up -d --force-recreate --remove-orphans
    
    log "SUCCESS" "✅ Nova versão iniciada"
}

# Função para health check
perform_health_check() {
    log "INFO" "🏥 Executando health check..."
    
    # Aguardar inicialização
    wait_for_service "localhost" "${API_PORT}" "${HEALTH_CHECK_TIMEOUT}" "API"
    wait_for_service "localhost" "${REDIS_PORT}" "${REDIS_TIMEOUT}" "Redis"
    
    # Health check completo
    if [ -f "${SCRIPTS_DIR}/health-check.sh" ]; then
        "${SCRIPTS_DIR}/health-check.sh" quick
    else
        # Fallback para health check básico
        timeout 30 bash -c "until curl -f -s '${HEALTH_ENDPOINT}' >/dev/null; do sleep 1; done"
    fi
    
    return $?
}

# Função para rollback
perform_rollback() {
    local backup_path="$1"
    
    log "ERROR" "🔄 Iniciando rollback..."
    
    if [ -f "${SCRIPTS_DIR}/rollback.sh" ]; then
        "${SCRIPTS_DIR}/rollback.sh"
    else
        log "ERROR" "Script de rollback não encontrado"
        return 1
    fi
}

# Função para limpeza de recursos antigos
cleanup_old_resources() {
    log "INFO" "🧹 Limpando recursos antigos..."
    
    # Manter apenas as últimas 3 imagens
    docker images "${REGISTRY}/${IMAGE_NAME}" --format "{{.Tag}}\t{{.ID}}" | \
        tail -n +4 | awk '{print $2}' | xargs -r docker rmi -f || true
    
    # Limpeza inteligente
    cleanup_resources
    
    log "SUCCESS" "✅ Limpeza concluída"
}

# Função principal
main() {
    local deploy_version="${1:-latest}"
    local force_redeploy="${2:-false}"
    
    log "INFO" "================================================"
    log "INFO" "🚀 DEPLOY OTIMIZADO - API BOLETOS GATEWAY"
    log "INFO" "================================================"
    
    # Validar argumentos
    if [ -z "${deploy_version}" ]; then
        log "ERROR" "Versão de deploy não especificada"
        exit 1
    fi
    
    # Executar deploy
    if deploy_application "${deploy_version}" "${force_redeploy}"; then
        log "SUCCESS" "🎉 Deploy concluído com sucesso!"
        log "INFO" "🌐 API disponível em: http://localhost:${API_PORT}"
        log "INFO" "📊 Health check: ${HEALTH_ENDPOINT}"
        exit 0
    else
        log "ERROR" "💥 Deploy falhou!"
        exit 1
    fi
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

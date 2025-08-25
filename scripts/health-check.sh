#!/bin/bash

set -euo pipefail

# Carregar configuração centralizada
source "$(dirname "$0")/config.sh"

# Função para health check completo
health_check() {
    local max_attempts=24
    local attempt=0
    local health_status=0
    
    log "INFO" "🏥 Iniciando health check completo..."
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        
        # Verificar se o container está rodando
        if ! is_container_running "${CONTAINER_NAME}"; then
            log "ERROR" "Container ${CONTAINER_NAME} não está rodando (tentativa $attempt/$max_attempts)"
            sleep 5
            continue
        fi
        
        # Verificar se o Redis está rodando
        if ! is_container_running "${REDIS_CONTAINER}"; then
            log "ERROR" "Container ${REDIS_CONTAINER} não está rodando (tentativa $attempt/$max_attempts)"
            sleep 5
            continue
        fi
        
        # Testar endpoint de saúde
        if curl -f -s "${HEALTH_ENDPOINT}" >/dev/null; then
            log "SUCCESS" "✅ Health check bem-sucedido na tentativa $attempt!"
            
            # Verificar detalhes da resposta
            local health_response=$(curl -s "${HEALTH_ENDPOINT}")
            log "INFO" "📊 Resposta do health check:"
            echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
            
            # Verificar métricas básicas
            check_basic_metrics
            
            health_status=0
            break
        else
            log "WARN" "⚠️ Health check falhou na tentativa $attempt/$max_attempts"
            
            # Mostrar logs se disponível
            if [ $attempt -eq $max_attempts ]; then
                log "ERROR" "📋 Últimos logs do container:"
                docker logs --tail 50 "${CONTAINER_NAME}" || true
            fi
            
            sleep 5
        fi
    done
    
    if [ $health_status -ne 0 ]; then
        log "ERROR" "❌ Health check falhou após $max_attempts tentativas"
        return 1
    fi
    
    return 0
}

# Função para verificar métricas básicas
check_basic_metrics() {
    log "INFO" "📊 Verificando métricas básicas..."
    
    # Verificar uso de memória
    local memory_usage=$(docker stats --no-stream --format "table {{.MemUsage}}" "${CONTAINER_NAME}" | tail -1)
    log "INFO" "💾 Uso de memória: ${memory_usage:-N/A}"
    
    # Verificar uso de CPU
    local cpu_usage=$(docker stats --no-stream --format "table {{.CPUPerc}}" "${CONTAINER_NAME}" | tail -1)
    log "INFO" "⚡ Uso de CPU: ${cpu_usage:-N/A}"
    
    # Verificar status dos containers
    log "INFO" "📋 Status dos containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    
    # Verificar conectividade com Redis
    if docker exec "${REDIS_CONTAINER}" redis-cli ping >/dev/null 2>&1; then
        log "SUCCESS" "✅ Redis está respondendo"
    else
        log "ERROR" "❌ Redis não está respondendo"
    fi
}

# Função para health check rápido (para uso em CI/CD)
quick_health_check() {
    log "INFO" "⚡ Health check rápido..."
    
    # Verificar se a aplicação responde em até 30 segundos
    if timeout 30 bash -c "until curl -f -s '${HEALTH_ENDPOINT}' >/dev/null; do sleep 1; done"; then
        log "SUCCESS" "✅ Health check rápido bem-sucedido"
        return 0
    else
        log "ERROR" "❌ Health check rápido falhou"
        return 1
    fi
}

# Função para health check detalhado (para debugging)
detailed_health_check() {
    log "INFO" "🔍 Health check detalhado..."
    
    # Verificar arquivos de log
    if [ -d "${LOGS_DIR}" ]; then
        log "INFO" "📁 Verificando arquivos de log..."
        find "${LOGS_DIR}" -name "*.log" -type f -exec ls -la {} \; 2>/dev/null || true
    fi
    
    # Verificar volumes
    log "INFO" "💾 Verificando volumes..."
    docker volume ls | grep -E "(redis|api)" || true
    
    # Verificar redes
    log "INFO" "🔗 Verificando redes..."
    docker network ls | grep proxy-network || true
    
    # Verificar processos dentro do container
    log "INFO" "⚙️ Verificando processos do container..."
    docker exec "${CONTAINER_NAME}" ps aux 2>/dev/null || log "WARN" "Não foi possível verificar processos"
    
    # Verificar variáveis de ambiente
    log "INFO" "🔧 Verificando variáveis de ambiente..."
    docker exec "${CONTAINER_NAME}" env | grep -E "(NODE_ENV|PORT|DB_|REDIS_|JWT_)" || true
}

# Função principal
main() {
    local check_type="${1:-full}"
    
    case "${check_type}" in
        "quick"|"fast")
            quick_health_check
            ;;
        "detailed"|"debug")
            detailed_health_check
            health_check
            ;;
        "full"|"complete"|*)
            health_check
            ;;
    esac
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log "SUCCESS" "🎉 Health check concluído com sucesso!"
        echo "HEALTH_STATUS=healthy" >> $GITHUB_ENV 2>/dev/null || true
    else
        log "ERROR" "💥 Health check falhou!"
        echo "HEALTH_STATUS=unhealthy" >> $GITHUB_ENV 2>/dev/null || true
    fi
    
    return $exit_code
}

# Executar se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

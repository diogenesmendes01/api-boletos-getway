# Dockerfile
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache wget curl postgresql-client

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig*.json ./

# Instalar dependências
RUN npm ci || npm install

# Copiar código fonte
COPY . .

# Build do TypeScript/NestJS
RUN npm run build

# Criar diretórios necessários
RUN mkdir -p logs uploads

# Script de entrada para rodar migrations
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "🔄 Aguardando banco de dados..."' >> /app/entrypoint.sh && \
    echo 'sleep 10' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "🔄 Rodando migrations..."' >> /app/entrypoint.sh && \
    echo 'npm run migration:run || echo "Migrations já executadas ou não configuradas"' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "✅ Iniciando aplicação..."' >> /app/entrypoint.sh && \
    echo 'npm run start:prod' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
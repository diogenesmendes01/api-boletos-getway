#!/bin/bash

echo "🚀 Iniciando ambiente de desenvolvimento..."

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado. Criando arquivo de exemplo..."
    cp .env.example .env
    echo "✅ Arquivo .env criado. Configure as variáveis conforme necessário."
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Verificar se o banco PostgreSQL está rodando
echo "🔍 Verificando conexão com PostgreSQL..."
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL não está rodando na porta 5432"
    echo "💡 Inicie o PostgreSQL ou use Docker:"
    echo "   docker-compose up postgres-olympia -d"
fi

# Verificar se o Redis está rodando
echo "🔍 Verificando conexão com Redis..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redis não está rodando"
    echo "💡 Inicie o Redis ou use Docker:"
    echo "   docker-compose up redis-olympia -d"
fi

echo "🔄 Iniciando aplicação em modo de desenvolvimento..."
echo "📖 Swagger disponível em: http://localhost:3000/docs"
echo "🔗 API disponível em: http://localhost:3000/v1"
echo ""

npm run start:dev

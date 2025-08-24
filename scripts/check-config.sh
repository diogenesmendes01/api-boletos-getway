#!/bin/bash

echo "🔍 Verificando configuração do ambiente..."
echo "=========================================="

# Verificar arquivos de ambiente
echo "📁 Arquivos de ambiente:"
if [ -f .env ]; then
    echo "✅ .env encontrado"
    echo "   API_BASE_URL: $(grep API_BASE_URL .env | cut -d'=' -f2 || echo 'não definido')"
    echo "   NODE_ENV: $(grep NODE_ENV .env | cut -d'=' -f2 || echo 'não definido')"
else
    echo "❌ .env não encontrado"
fi

if [ -f .env.production ]; then
    echo "✅ .env.production encontrado"
    echo "   API_BASE_URL: $(grep API_BASE_URL .env.production | cut -d'=' -f2 || echo 'não definido')"
else
    echo "❌ .env.production não encontrado"
fi

echo ""

# Verificar docker-compose
echo "🐳 Configuração Docker:"
if [ -f docker-compose.yml ]; then
    echo "✅ docker-compose.yml encontrado"
    echo "   API_BASE_URL: $(grep API_BASE_URL docker-compose.yml | cut -d'=' -f2 || echo 'não definido')"
else
    echo "❌ docker-compose.yml não encontrado"
fi

if [ -f docker-compose.prod.yml ]; then
    echo "✅ docker-compose.prod.yml encontrado"
    echo "   API_BASE_URL: $(grep API_BASE_URL docker-compose.prod.yml | cut -d'=' -f2 || echo 'não definido')"
else
    echo "❌ docker-compose.prod.yml não encontrado"
fi

echo ""

# Verificar se a aplicação está rodando
echo "🚀 Status da aplicação:"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API rodando em http://localhost:3000"
    echo "📖 Swagger disponível em: http://localhost:3000/docs"
else
    echo "❌ API não está rodando em http://localhost:3000"
fi

echo ""
echo "🔧 Para resolver problemas de CORS:"
echo "   1. Verifique se API_BASE_URL está configurado corretamente"
echo "   2. Reinicie a aplicação após alterações"
echo "   3. Use npm run dev para desenvolvimento local"

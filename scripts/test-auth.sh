#!/bin/bash

echo "🧪 Testando API de Autenticação"
echo "================================"

# Configurações
API_BASE="http://localhost:3000/v1"
OLYMPIA_TOKEN="seu_token_olympia_aqui"

echo ""
echo "1️⃣ Testando Login (Email + Token OlympiaBank)..."
echo "POST $API_BASE/auth/login"
echo "📝 Formato: email + olympiaToken"

# Dados de teste
LOGIN_DATA=$(cat <<EOF
{
  "email": "usuario@empresa.com",
  "olympiaToken": "$OLYMPIA_TOKEN"
}
EOF
)

echo "📤 Dados enviados:"
echo "$LOGIN_DATA"

# Fazer login
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_DATA")

echo ""
echo "📥 Resposta do login:"
echo "$LOGIN_RESPONSE"

# Extrair token JWT
JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$JWT_TOKEN" ]; then
    echo ""
    echo "✅ Login realizado com sucesso!"
    echo "🔑 JWT Token: ${JWT_TOKEN:0:50}..."
    
    echo ""
    echo "2️⃣ Testando validação do token..."
    echo "POST $API_BASE/auth/validate"
    
    VALIDATE_RESPONSE=$(curl -s -X POST "$API_BASE/auth/validate" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json")
    
    echo "📥 Resposta da validação:"
    echo "$VALIDATE_RESPONSE"
    
    echo ""
    echo "3️⃣ Testando refresh do token..."
    echo "POST $API_BASE/auth/refresh"
    
    REFRESH_RESPONSE=$(curl -s -X POST "$API_BASE/auth/refresh" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json")
    
    echo "📥 Resposta do refresh:"
    echo "$REFRESH_RESPONSE"
    
    echo ""
    echo "4️⃣ Testando logout..."
    echo "POST $API_BASE/auth/logout"
    
    LOGOUT_RESPONSE=$(curl -s -X POST "$API_BASE/auth/logout" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json")
    
    echo "📥 Resposta do logout:"
    echo "$LOGOUT_RESPONSE"
    
else
    echo ""
    echo "❌ Falha no login!"
    echo "Verifique se a API está rodando e se o token do OlympiaBank é válido."
fi

echo ""
echo "🎯 Teste concluído!"
echo ""
echo "💡 Para usar em produção:"
echo "   1. Configure JWT_SECRET no ambiente"
echo "   2. Use HTTPS em produção"
echo "   3. Configure CORS adequadamente"
echo "   4. Monitore os logs de autenticação"

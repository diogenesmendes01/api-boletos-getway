# Guia de Autenticação para Frontend

## Visão Geral

Este guia explica como integrar o frontend com o sistema de autenticação da API de Boletos Gateway. O sistema usa JWT (JSON Web Tokens) para autenticação e permite que cada usuário tenha seu próprio token OlympiaBank.

## Fluxo de Autenticação

### 1. Login do Usuário
```javascript
// Frontend envia:
POST /v1/auth/login
{
  "email": "usuario@empresa.com",
  "olympiaToken": "seu_token_olympia_aqui"
}
```

### 2. Resposta da API
```javascript
// API retorna:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "username": "usuario@empresa.com",
  "email": "usuario@empresa.com",
  "companyName": "Empresa ABC LTDA",
  "companyDocument": "12.345.678/0001-90",
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "message": "Login realizado com sucesso"
}
```

## Como Usar o JWT

### 3. Todas as Operações Autenticadas
```javascript
// Sempre usar o JWT retornado no header Authorization:
const response = await fetch('/v1/imports', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'multipart/form-data'
  },
  body: formData
});
```

## Implementação Completa

### Classe AuthService para Frontend
```javascript
class AuthService {
  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.user = JSON.parse(localStorage.getItem('user') || '{}');
  }

  async login(email, olympiaToken) {
    try {
      const response = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, olympiaToken })
      });
      
      if (!response.ok) {
        throw new Error('Falha no login');
      }
      
      const data = await response.json();
      
      // Salvar dados no localStorage
      this.accessToken = data.accessToken;
      this.user = {
        userId: data.userId,
        username: data.username,
        email: data.email,
        companyName: data.companyName,
        companyDocument: data.companyDocument
      };
      
      localStorage.setItem('accessToken', this.accessToken);
      localStorage.setItem('user', JSON.stringify(this.user));
      
      return data;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  async logout() {
    try {
      if (this.accessToken) {
        await fetch('/v1/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
      }
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      // Limpar dados locais
      this.accessToken = null;
      this.user = {};
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
  }

  async refreshToken() {
    try {
      const response = await fetch('/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        localStorage.setItem('accessToken', this.accessToken);
        return data;
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      // Se falhar, fazer logout
      await this.logout();
    }
  }

  async validateToken() {
    try {
      const response = await fetch('/v1/auth/validate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getUser() {
    return this.user;
  }

  getAccessToken() {
    return this.accessToken;
  }
}
```

### Exemplo de Uso
```javascript
// Inicializar serviço
const authService = new AuthService();

// Login
try {
  const loginResult = await authService.login('usuario@empresa.com', 'token_olympia');
  console.log('Login realizado:', loginResult.companyName);
} catch (error) {
  console.error('Falha no login:', error.message);
}

// Verificar se está autenticado
if (authService.isAuthenticated()) {
  console.log('Usuário logado:', authService.getUser().companyName);
}

// Upload de arquivo
async function uploadFile(file) {
  if (!authService.isAuthenticated()) {
    throw new Error('Usuário não autenticado');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('webhookUrl', 'https://webhook.site/seu-id');

  const response = await fetch('/v1/imports', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authService.getAccessToken()}`
    },
    body: formData
  });

  return response.json();
}
```

## Endpoints Disponíveis

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| `POST` | `/v1/auth/login` | Login do usuário | Não |
| `POST` | `/v1/auth/logout` | Logout do usuário | JWT |
| `POST` | `/v1/auth/refresh` | Renovar JWT | JWT |
| `POST` | `/v1/auth/validate` | Validar JWT | JWT |
| `POST` | `/v1/imports` | Upload de arquivo CSV | JWT |

## Pontos Importantes

### Segurança
- **JWT válido por 30 dias**
- **Sempre usar HTTPS em produção**
- **Não armazenar tokens em variáveis globais**
- **Implementar refresh automático de token**

### Dados do Usuário
- **Email serve como username**
- **Company info é obtida automaticamente da API OlympiaBank**
- **Cada usuário tem seu próprio token OlympiaBank**
- **Dados são persistidos no localStorage**

### Tratamento de Erros
```javascript
// Interceptor para requisições HTTP
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${authService.getAccessToken()}`,
        ...options.headers
      }
    });

    if (response.status === 401) {
      // Token expirado, tentar renovar
      await authService.refreshToken();
      // Reenviar requisição com novo token
      return fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${authService.getAccessToken()}`,
          ...options.headers
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}
```

## Exemplo de Componente React

```jsx
import React, { useState, useEffect } from 'react';
import { AuthService } from './AuthService';

function LoginComponent() {
  const [email, setEmail] = useState('');
  const [olympiaToken, setOlympiaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authService.login(email, olympiaToken);
      console.log('Login realizado com sucesso:', result.companyName);
      // Redirecionar ou atualizar estado da aplicação
    } catch (error) {
      setError('Falha no login: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={olympiaToken}
        onChange={(e) => setOlympiaToken(e.target.value)}
        placeholder="Token Olympia"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

## Resumo

1. **Login simples**: apenas email + olympiaToken
2. **JWT retornado**: usar em todas as requisições
3. **Token válido por 30 dias**: implementar refresh automático
4. **Cada usuário tem seu token OlympiaBank**: API gerencia automaticamente
5. **Endpoints protegidos**: sempre incluir Authorization header

**É isso! Sistema simples e seguro para autenticação frontend.**

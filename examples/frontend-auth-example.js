/**
 * Exemplo de uso da API de Autenticação no Frontend
 * 
 * Este arquivo demonstra como implementar o fluxo de autenticação
 * usando apenas email e token OlympiaBank
 */

class AuthService {
  constructor(baseUrl = 'http://localhost:3000/v1') {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.user = null;
  }

  /**
   * Login do usuário
   * @param {string} email - Email do usuário
   * @param {string} olympiaToken - Token do OlympiaBank
   */
  async login(email, olympiaToken) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          olympiaToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Armazenar token e dados do usuário
      this.accessToken = data.accessToken;
      this.user = {
        userId: data.userId,
        username: data.username,
        email: data.email,
        companyName: data.companyName,
        companyDocument: data.companyDocument,
        expiresAt: data.expiresAt,
      };

      // Salvar no localStorage (opcional)
      localStorage.setItem('accessToken', this.accessToken);
      localStorage.setItem('user', JSON.stringify(this.user));

      console.log('✅ Login realizado com sucesso:', data.message);
      return data;
    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      throw error;
    }
  }

  /**
   * Logout do usuário
   */
  async logout() {
    if (!this.accessToken) {
      return;
    }

    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      // Limpar dados locais
      this.accessToken = null;
      this.user = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');

      console.log('✅ Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro no logout:', error.message);
    }
  }

  /**
   * Renovar token JWT
   */
  async refreshToken() {
    if (!this.accessToken) {
      throw new Error('Nenhum token disponível para renovar');
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.accessToken;
      localStorage.setItem('accessToken', this.accessToken);

      console.log('✅ Token renovado com sucesso');
      return data;
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error.message);
      throw error;
    }
  }

  /**
   * Fazer requisição autenticada para a API
   */
  async authenticatedRequest(url, options = {}) {
    if (!this.accessToken) {
      throw new Error('Usuário não autenticado');
    }

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Se token expirou, tentar renovar
      if (response.status === 401) {
        await this.refreshToken();
        
        // Tentar novamente com o novo token
        headers.Authorization = `Bearer ${this.accessToken}`;
        return fetch(url, {
          ...options,
          headers,
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Erro na requisição autenticada:', error.message);
      throw error;
    }
  }

  /**
   * Upload de arquivo para importação
   */
  async uploadFile(file, webhookUrl = null) {
    const formData = new FormData();
    formData.append('file', file);
    
    if (webhookUrl) {
      formData.append('webhookUrl', webhookUrl);
    }

    const response = await this.authenticatedRequest(`${this.baseUrl}/imports`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Verificar se o usuário está autenticado
   */
  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }

  /**
   * Restaurar sessão do localStorage
   */
  restoreSession() {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');

    if (token && user) {
      this.accessToken = token;
      this.user = JSON.parse(user);
      return true;
    }

    return false;
  }
}

// Exemplo de uso
async function exemploUso() {
  const auth = new AuthService();

  try {
    // 1. Login do usuário
    console.log('🔐 Fazendo login...');
    await auth.login('usuario@empresa.com', 'seu_token_olympia_aqui');
    
    console.log('👤 Usuário logado:', auth.user);
    console.log('🏢 Empresa:', auth.user.companyName);

    // 2. Upload de arquivo
    console.log('📤 Fazendo upload de arquivo...');
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (file) {
      const result = await auth.uploadFile(file, 'https://webhook.site/seu-id');
      console.log('✅ Upload realizado:', result);
    }

    // 3. Logout
    console.log('🚪 Fazendo logout...');
    await auth.logout();
    console.log('✅ Logout realizado');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Restaurar sessão ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  const auth = new AuthService();
  if (auth.restoreSession()) {
    console.log('🔄 Sessão restaurada:', auth.user);
  }
});

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}

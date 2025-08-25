# 📋 Versões das Ações do GitHub - Workflow Deploy

## 🔄 Ações Atualizadas (2025)

### **GitHub Actions Core**
- `actions/checkout@v4` - Checkout do código
- `actions/setup-node@v4` - Setup do Node.js
- `actions/cache@v4` - Cache de dependências
- `actions/upload-artifact@v4` - Upload de artefatos

### **Docker Actions**
- `docker/setup-buildx-action@v4` - Setup do Docker Buildx
- `docker/login-action@v4` - Login no registry
- `docker/metadata-action@v6` - Metadados Docker
- `docker/build-push-action@v6` - Build e push de imagens

### **SSH/SCP Actions**
- `appleboy/scp-action@v0.1.8` - Upload de arquivos via SCP
- `appleboy/ssh-action@v1.0.3` - Execução de comandos via SSH

## 📅 Histórico de Atualizações

### **Janeiro 2025**
- ✅ Atualizado `actions/upload-artifact` de v3 para v4
- ✅ Atualizado `actions/cache` de v3 para v4
- ✅ Atualizado `docker/setup-buildx-action` de v3 para v4
- ✅ Atualizado `docker/login-action` de v3 para v4
- ✅ Atualizado `docker/metadata-action` de v5 para v6
- ✅ Atualizado `docker/build-push-action` de v5 para v6
- ✅ Atualizado `appleboy/scp-action` de v0.1.7 para v0.1.8
- ✅ Atualizado `appleboy/ssh-action` de v1.0.0 para v1.0.3

## 🚨 Ações Depreciadas

### **Não usar mais:**
- ❌ `actions/upload-artifact@v3` - Depreciado em 16/04/2024
- ❌ `actions/cache@v3` - Versão antiga
- ❌ `docker/setup-buildx-action@v3` - Versão antiga
- ❌ `docker/login-action@v3` - Versão antiga
- ❌ `docker/metadata-action@v5` - Versão antiga
- ❌ `docker/build-push-action@v5` - Versão antiga

## 🔍 Como Verificar Versões Atuais

### **Verificar versões disponíveis:**
```bash
# Para ações do GitHub
gh api repos/actions/checkout/releases --jq '.[0].tag_name'

# Para ações do Docker
gh api repos/docker/setup-buildx-action/releases --jq '.[0].tag_name'
```

### **Verificar se há atualizações:**
```bash
# Usar dependabot para atualizações automáticas
# ou verificar manualmente a cada 3 meses
```

## 📚 Recursos Úteis

- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [Docker GitHub Actions](https://github.com/docker/github-actions)
- [Appleboy SSH Actions](https://github.com/appleboy/ssh-action)
- [GitHub Blog - Deprecações](https://github.blog/changelog/)

## ⚠️ Notas Importantes

1. **Sempre testar** novas versões em ambiente de desenvolvimento
2. **Verificar changelog** antes de atualizar versões major
3. **Manter compatibilidade** com o ambiente de produção
4. **Documentar mudanças** significativas entre versões

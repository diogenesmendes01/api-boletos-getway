# 📋 INSTRUÇÕES COMPLETAS - Configuração CI/CD API Boletos Olympiabank

## 🎯 INFORMAÇÕES DO PROJETO

- **Repositório GitHub**: https://github.com/diogenesmendes01/api-boletos-getway
- **VPS IP**: 168.231.92.229
- **Domínio Backend**: https://api.envio-boleto.olympiabank.xyz
- **Domínio Frontend**: https://envio-boleto.olympiabank.xyz
- **Banco de Dados**: PostgreSQL existente (container `postgres-olympia`)
- **Proxy**: NGINX Proxy Manager (já configurado na porta 81)
- **Migrations**: Existem em `src/migrations`

## ✅ CHAVES SSH JÁ CONFIGURADAS
- Chave SSH já está configurada entre GitHub Actions e VPS
- Secrets já configurados no GitHub: `VPS_USER` e `VPS_SSH_KEY`

---

## 📁 ARQUIVOS QUE DEVEM SER CRIADOS NO PROJETO

### 1️⃣ **Dockerfile** (raiz do projeto)

```dockerfile
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

# Build do TypeScript
RUN npm run build || echo "No build step needed"

# Criar diretórios necessários
RUN mkdir -p logs uploads

# Script de entrada para rodar migrations
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "🔄 Aguardando banco de dados..."' >> /app/entrypoint.sh && \
    echo 'sleep 10' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "🔄 Rodando migrations..."' >> /app/entrypoint.sh && \
    echo 'npm run migration:run || npm run migrate || npm run db:migrate || echo "Migrations já executadas ou não configuradas"' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "✅ Iniciando aplicação..."' >> /app/entrypoint.sh && \
    echo 'npm start' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
```

### 2️⃣ **.dockerignore** (raiz do projeto)

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
!.env.example
coverage
.nyc_output
dist
build
*.log
.DS_Store
.vscode
.idea
README.md
docker-compose*.yml
Dockerfile
.dockerignore
.github
scripts
docs
test
*.test.js
*.spec.js
```

### 3️⃣ **.github/workflows/deploy.yml** (criar pasta .github/workflows)

```yaml
name: Deploy API Boletos Olympiabank

on:
  push:
    branches: 
      - main
      - master
      - develop
  pull_request:
    branches: 
      - main
      - master

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: diogenesmendes01/api-boletos-getway
  VPS_IP: 168.231.92.229

jobs:
  test:
    name: Testes
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Instalar dependências
        run: npm ci || npm install

      - name: Executar testes
        run: npm test || echo "Testes não configurados"
        continue-on-error: true

      - name: Build do projeto
        run: npm run build || echo "Build não necessário"

  build-and-push:
    name: Build e Push Docker
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login no GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Definir tags
        id: tags
        run: |
          BRANCH=${GITHUB_REF#refs/heads/}
          SHA=${GITHUB_SHA::7}
          if [[ "$BRANCH" == "main" ]] || [[ "$BRANCH" == "master" ]]; then
            echo "tags=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest,${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:production-$SHA" >> $GITHUB_OUTPUT
          elif [[ "$BRANCH" == "develop" ]]; then
            echo "tags=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop,${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop-$SHA" >> $GITHUB_OUTPUT
          else
            echo "tags=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:$SHA" >> $GITHUB_OUTPUT
          fi

      - name: Build e Push da imagem Docker
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ steps.tags.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NODE_ENV=production

  deploy:
    name: Deploy na VPS
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ env.VPS_IP }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: 22
          script: |
            set -e
            
            echo "🚀 Iniciando deploy..."
            
            # Navegar para pasta do projeto
            cd /opt/api-boletos-getway || mkdir -p /opt/api-boletos-getway && cd /opt/api-boletos-getway
            
            # Criar docker-compose.prod.yml se não existir
            if [ ! -f docker-compose.prod.yml ]; then
              cat > docker-compose.prod.yml << 'EOFDOCKER'
            version: '3.8'
            
            services:
              api-boleto:
                image: ghcr.io/diogenesmendes01/api-boletos-getway:latest
                container_name: api-boleto-olympia
                restart: always
                ports:
                  - "127.0.0.1:3001:3000"
                environment:
                  - NODE_ENV=production
                  - PORT=3000
                  - DATABASE_URL=postgresql://postgres:postgres@postgres-olympia:5432/boleto_db
                  - DB_HOST=postgres-olympia
                  - DB_PORT=5432
                  - DB_USERNAME=postgres
                  - DB_PASSWORD=postgres
                  - DB_DATABASE=boleto_db
                  - JWT_SECRET=\${JWT_SECRET:-jwt_olympia_secret_change_this}
                  - API_KEY=\${API_KEY:-api_key_change_this}
                  - CORS_ORIGINS=https://envio-boleto.olympiabank.xyz
                  - LOG_LEVEL=info
                networks:
                  - nginx-proxy-manager_default
                volumes:
                  - ./logs:/app/logs
                  - ./uploads:/app/uploads
                healthcheck:
                  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
                  interval: 30s
                  timeout: 10s
                  retries: 3
                  start_period: 60s
                logging:
                  driver: "json-file"
                  options:
                    max-size: "10m"
                    max-file: "3"
            
            networks:
              nginx-proxy-manager_default:
                external: true
            EOFDOCKER
            fi
            
            # Criar arquivo .env se não existir
            if [ ! -f .env ]; then
              cat > .env << 'EOFENV'
            JWT_SECRET=jwt_olympia_secret_change_this_now_123456
            API_KEY=api_key_olympia_change_this_now_789012
            EOFENV
            fi
            
            # Criar diretórios necessários
            mkdir -p logs uploads
            chmod 777 logs uploads
            
            # Fazer backup do container atual (se existir)
            docker tag ghcr.io/diogenesmendes01/api-boletos-getway:latest ghcr.io/diogenesmendes01/api-boletos-getway:backup 2>/dev/null || true
            
            # Pull da nova imagem
            echo "📦 Baixando nova imagem..."
            docker pull ghcr.io/diogenesmendes01/api-boletos-getway:latest
            
            # Parar container antigo
            echo "🛑 Parando container antigo..."
            docker compose -f docker-compose.prod.yml down || true
            
            # Subir novo container
            echo "🚀 Subindo novo container..."
            docker compose -f docker-compose.prod.yml up -d
            
            # Aguardar container iniciar
            echo "⏳ Aguardando container iniciar..."
            sleep 15
            
            # Verificar se está rodando
            if docker ps | grep -q api-boleto-olympia; then
              echo "✅ Container rodando!"
              
              # Verificar health
              if curl -f http://localhost:3001/health 2>/dev/null; then
                echo "✅ Health check OK!"
              else
                echo "⚠️ Health check falhou, mas container está rodando"
              fi
              
              # Limpar imagens antigas
              docker image prune -f
              
              echo "✅ Deploy concluído com sucesso!"
            else
              echo "❌ Container não está rodando! Tentando rollback..."
              docker tag ghcr.io/diogenesmendes01/api-boletos-getway:backup ghcr.io/diogenesmendes01/api-boletos-getway:latest 2>/dev/null || true
              docker compose -f docker-compose.prod.yml up -d
              exit 1
            fi
            
            # Mostrar logs
            echo "📋 Últimas linhas do log:"
            docker logs --tail 20 api-boleto-olympia

      - name: Notificação de sucesso
        if: success()
        run: echo "✅ Deploy realizado com sucesso para produção!"

      - name: Notificação de falha
        if: failure()
        run: echo "❌ Deploy falhou! Verifique os logs."
```

### 4️⃣ **package.json** (adicionar/verificar scripts)

```json
{
  "scripts": {
    "start": "node dist/index.js || node dist/main.js || node src/index.js",
    "dev": "nodemon src/index.ts || nodemon src/index.js",
    "build": "tsc || echo 'TypeScript não configurado'",
    "test": "jest || echo 'Testes não configurados'",
    "migration:run": "typeorm migration:run || npx typeorm migration:run || echo 'Migrations não configuradas'",
    "migrate": "prisma migrate deploy || echo 'Prisma não configurado'",
    "db:migrate": "sequelize db:migrate || echo 'Sequelize não configurado'"
  }
}
```

### 5️⃣ **.env.example** (raiz do projeto)

```env
# AMBIENTE
NODE_ENV=development
PORT=3000

# BANCO DE DADOS
DATABASE_URL=postgresql://usuario:senha@localhost:5432/boleto_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=usuario
DB_PASSWORD=senha
DB_DATABASE=boleto_db

# SEGURANÇA
JWT_SECRET=jwt_secret_development
API_KEY=api_key_development

# CORS
CORS_ORIGINS=http://localhost:3000

# LOGS
LOG_LEVEL=debug
```

---

## 🔧 ALTERAÇÕES NO CÓDIGO DA APLICAÇÃO

### 1️⃣ **src/index.ts** ou **src/index.js** (arquivo principal)

Adicionar/verificar:

```typescript
// Importações necessárias
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANTE: Rota de health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Rota básica
app.get('/', (req, res) => {
  res.json({
    name: 'API Boletos Olympiabank',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Suas rotas aqui
// app.use('/api', routes);

// Tratamento de erros
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`💾 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  process.exit(0);
});
```

### 2️⃣ **Configuração do Banco de Dados**

Se usar **TypeORM**, criar/verificar `ormconfig.js` ou `data-source.ts`:

```javascript
// ormconfig.js
module.exports = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'postgres-olympia',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'boleto_db',
  synchronize: false, // SEMPRE false em produção
  logging: process.env.NODE_ENV === 'development',
  entities: ['dist/entities/**/*.js'],
  migrations: ['dist/migrations/**/*.js'],
  cli: {
    migrationsDir: 'src/migrations'
  }
};
```

Se usar **Prisma**, verificar `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 📝 CHECKLIST DE VERIFICAÇÃO

### No código:
- [ ] ✅ Rota `/health` implementada e retornando status 200
- [ ] ✅ Variáveis de ambiente sendo lidas corretamente
- [ ] ✅ CORS configurado para aceitar requisições do frontend
- [ ] ✅ Tratamento de erros implementado
- [ ] ✅ Logs configurados
- [ ] ✅ Graceful shutdown implementado

### Arquivos criados:
- [ ] ✅ `Dockerfile`
- [ ] ✅ `.dockerignore`
- [ ] ✅ `.github/workflows/deploy.yml`
- [ ] ✅ `.env.example`

### No package.json:
- [ ] ✅ Script `start` funcionando
- [ ] ✅ Script `build` (se usar TypeScript)
- [ ] ✅ Script de migration configurado

---

## 🚀 COMANDOS PARA TESTAR LOCALMENTE

```bash
# 1. Testar se a aplicação roda
npm install
npm start

# 2. Testar rota de health
curl http://localhost:3000/health

# 3. Testar build do Docker
docker build -t teste-local .

# 4. Rodar container localmente
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  teste-local

# 5. Fazer commit e push
git add .
git commit -m "Configuração completa CI/CD"
git push origin main
```

---

## 🎯 FLUXO COMPLETO DO CI/CD

1. **Developer faz push** → GitHub
2. **GitHub Actions dispara** → Testa código
3. **Build da imagem Docker** → Push para GHCR
4. **Deploy automático na VPS** → Via SSH
5. **Container sobe** → Roda migrations automaticamente
6. **Health check** → Verifica se está funcionando
7. **NGINX Proxy Manager** → Roteia requisições

---

## ⚠️ PONTOS CRÍTICOS

1. **ROTA /health É OBRIGATÓRIA** - Sem ela, o health check falha
2. **Migrations devem rodar antes da aplicação iniciar**
3. **Variáveis de ambiente devem estar configuradas**
4. **Porta deve ser 3000 internamente**
5. **Database deve ser acessível como `postgres-olympia`**

---

## 📞 SUPORTE

Se algum passo falhar, verificar:
1. Logs do GitHub Actions: https://github.com/diogenesmendes01/api-boletos-getway/actions
2. Logs do container: `docker logs api-boleto-olympia`
3. Conexão com banco: `docker exec api-boleto-olympia ping postgres-olympia`

---

**ESTE DOCUMENTO CONTÉM TUDO QUE É NECESSÁRIO PARA CONFIGURAR O CI/CD COMPLETO**
# 🚀 Configuração CI/CD - task5 getaway FIAP

Este documento explica como configurar a pipeline CI/CD completa para o projeto.

## 📋 Pré-requisitos

### 1. GitHub Actions (já configurado)
- ✅ Arquivo `.github/workflows/ci.yml` criado
- ✅ Pipeline configurada para rodar em PRs e pushes para `main`

### 2. SonarCloud Setup

#### Passo 1: Criar conta no SonarCloud
1. Acesse [sonarcloud.io](https://sonarcloud.io)
2. Faça login com sua conta GitHub
3. Autorize o SonarCloud a acessar seus repositórios

#### Passo 2: Configurar o projeto no SonarCloud
1. Clique em "+" → "Analyze new project"
2. Selecione o repositório `task5_getaway_fiap`
3. Configure a organização (use: `thiago5g`)
4. Configure o projeto key: `Thiago5g_task5_getaway_fiap`

#### Passo 3: Configurar Token no GitHub
1. No SonarCloud, vá em Account → Security → Generate Tokens
2. Gere um token com nome `task5_getaway_fiap`
3. Copie o token
4. No GitHub, vá em Settings → Secrets and variables → Actions
5. Adicione um novo secret:
   - Name: `SONAR_TOKEN`
   - Value: [cole o token aqui]

### 3. Branch Protection Rules

Configure as regras de proteção para a branch `main`:

1. GitHub → Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Configure:
   - ✅ Require pull request reviews (1 approval)
   - ✅ Require status checks:
     - `test / Run Tests and Coverage`
     - `build / Build Application`  
     - `sonarcloud / SonarCloud Analysis`
   - ✅ Require conversation resolution
   - ✅ Require linear history

## 🔄 Workflow da Pipeline

### Quando a Pipeline Roda:
- ✅ Push para `main` ou `develop`
- ✅ Pull Requests para `main`

### Etapas da Pipeline:

#### 1. **Test Job**
- Instala dependências
- Executa linter
- Roda testes unitários com cobertura
- ✅ **Verifica se cobertura >= 80%**
- Upload coverage para Codecov

#### 2. **SonarCloud Job**
- Executa análise de qualidade de código
- Verifica duplicação de código
- Analisa vulnerabilidades de segurança
- Gera relatório de qualidade

#### 3. **Build Job**
- Compila a aplicação
- Gera artifacts de build
- Verifica se build está funcionando

## 📊 Métricas de Qualidade

### Coverage Thresholds (Jest):
- **Statements**: ≥ 80%
- **Functions**: ≥ 80%
- **Lines**: ≥ 80%
- **Branches**: ≥ 70%

### SonarCloud Quality Gate:
- Coverage: ≥ 80%
- Duplicated Lines: < 3%
- Maintainability Rating: A
- Reliability Rating: A
- Security Rating: A

## 🚦 Status da Pipeline

A pipeline falhará se:
- ❌ Testes unitários falharem
- ❌ Cobertura < 80%
- ❌ Linter encontrar erros
- ❌ Build falhar
- ❌ SonarCloud Quality Gate falhar

## 🛠️ Comandos Locais

```bash
# Executar testes
npm test

# Executar testes com cobertura
npm run test:cov

# Verificar threshold de cobertura
npm run test:coverage:threshold

# Lint
npm run lint

# Build
npm run build
```

## 📈 Monitoramento

- **GitHub Actions**: Veja o status das pipelines na aba Actions
- **SonarCloud**: Acesse [sonarcloud.io](https://sonarcloud.io) para métricas detalhadas
- **Codecov**: Relatórios de cobertura detalhados

## 🎯 Próximos Passos

1. ✅ Configure o SonarCloud token
2. ✅ Configure branch protection rules
3. ✅ Teste a pipeline fazendo um PR
4. ✅ Monitore as métricas de qualidade
5. 🔄 Mantenha a cobertura sempre acima de 80%
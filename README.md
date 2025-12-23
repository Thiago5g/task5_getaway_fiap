# Plataforma de Revenda de Veículos – Backend API

![CI](https://github.com/Thiago5g/task5_getaway_fiap/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-80%2B-green?style=flat)
![Sonar Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=REPLACE_ME_PROJECT_KEY&metric=alert_status)
![Sonar Maintainability](https://sonarcloud.io/api/project_badges/measure?project=REPLACE_ME_PROJECT_KEY&metric=sqale_rating)
![Sonar Security](https://sonarcloud.io/api/project_badges/measure?project=REPLACE_ME_PROJECT_KEY&metric=security_rating)

> Substitua `REPLACE_ME_PROJECT_KEY` após configurar o projeto no SonarCloud.

Esta é a API para uma plataforma de revenda de veículos construída com NestJS e TypeORM, como parte do desafio Sub Tech Challenge do curso SOAT – PósTech (fase 3).

---

## 📋 Descrição do Projeto

O sistema permite:
- Cadastro, edição e listagem de veículos (disponíveis e vendidos), ordenados por preço.
- Cadastro e atualização de clientes.
- Registro de vendas (status do veículo atualizado localmente; dados consolidados em microserviço externo de vendas).
- Autenticação de usuários (via módulo `auth`), com login, validação e verificação de permissões.

A autenticação está implementada internamente com JWT, mas pode ser migrada para serviço externo conforme requisito.

---

## 🧱 Arquitetura e Módulos

- **auth**: autenticação/login de usuários via JWT.
- **usuarios**: validação da existência de usuários e associação a autenticação.
- **clientes**: cadastro e atualização de dados de clientes (quantidade de carros comprados, dados pessoais etc.).
- **veiculos**: CRUD de veículos e endpoints de listagem (disponíveis e vendidos).
- **vendas**: resolve cliente por CPF e veículo por placa, atualiza status local e envia (clienteId, veiculoId, preco) para microserviço externo de vendas (configurável via `SALES_MS_URL`). Não há mais tabela local de vendas.

Cada módulo está isolado com controladores, serviços e DTOs, utilizando TypeORM para persistência em banco de dados relacional.

---

## ⚙️ Requisitos para rodar localmente

1. Clone este repositório.
2. Instale dependências com `npm install`.
3. Rode a aplicação com `npm run start:dev`.

---

## 🔌 Endpoints de Vendas (Integração com Microserviço)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/vendas` | Realiza uma venda. Body: `{ cpf, placa, preco }` |
| GET | `/vendas` | Lista vendas retornadas pelo microserviço enriquecidas com dados locais de cliente e veículo |
| GET | `/vendas/placa/:placa` | Retorna a venda (microserviço) de um veículo identificado pela placa, enriquecida com cliente e veículo |

Observações:
- Persistência da venda ocorre somente no microserviço externo.
- Esta API apenas atualiza o status do veículo para `VENDIDO` localmente.
- Variável de ambiente: `SALES_MS_URL` define a base do microserviço (default `http://localhost:3001`).

---

## 🧪 Testes e Cobertura

Executar testes:

```
npm run test:cov
```

Cobertura mínima exigida: 80% (branches, functions, lines, statements). Ajuste em `package.json` se necessário.

Principais suites atuais:
- Utils de cálculo financeiro
- Integração microserviço de vendas (`venda.service` e client)
- Webhook de pagamentos (service + middleware assinatura HMAC)

Para rodar apenas e2e (quando adicionados):

```
npm run test:e2e
```

---

## 💳 Webhook de Pagamentos

Endpoint público para recebimento de eventos de pagamento de um provedor externo.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/webhooks/payments` | Recebe evento de pagamento assinado (HMAC) |

### Status aceitos (PT → enviados ao microserviço em EN)

| Recebido (PT) | Encaminhado (EN) | Observações |
|---------------|-----------------|-------------|
| `PAGO`        | `PAID`          | Inclui campo `preco` se presente |
| `CANCELADO`   | `CANCELED`      | Remove `preco` do forward |
| `FALHOU`      | `FAILED`        | Mantém payload básico |
| `PENDENTE`    | `PENDING`       | Mantém payload básico |

### Assinatura HMAC

Header: `X-Signature`

Formato: `t=<timestamp_ms>,sig=<hex_hmac>`

String assinada: `t=<timestamp_ms>.<raw_body_json>`

Algoritmo: `HMAC-SHA256` usando o segredo `PAYMENT_WEBHOOK_SECRET`.

Janela de tolerância: 5 minutos (timestamps fora disso são rejeitados - proteção contra replay).

Exemplo de geração (Node / pseudo):

```ts
const rawBody = JSON.stringify(payload);
const ts = Date.now();
const data = `t=${ts}.${rawBody}`;
const sig = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(data).digest('hex');
const header = `t=${ts},sig=${sig}`;
```

### Idempotência

- Cada evento possui `eventId` (recebido).
- Armazenado na tabela `payment_webhook_events` com colunas: `evento_id` (UNIQUE), `dados` (jsonb), `criado_em`.
- Eventos repetidos retornam `{ received: true, duplicate: true }` sem reenviar ao microserviço.

### Forward para Microserviço de Vendas

- Rota interna: `PUT /internal/payments/sync` (no serviço de vendas) – configurável via `SALES_SERVICE_URL`.
- Mapeamento de status PT→EN conforme tabela acima.
- Remove `preco` em cancelamentos e inclui somente quando status é `PAGO`.
- Falha no forward não gera exception (log de erro + retorno 201 ao provedor) – possibilidade futura: fila de retry.

### Postman

Arquivo `postman_collection.json` inclui:
- Scripts para gerar assinatura `X-Signature` automaticamente.
- Exemplos de payloads para `PAGO`, `PENDENTE`, `CANCELADO`, `FALHOU`.

---

## 🔑 Variáveis de Ambiente

| Nome | Descrição | Default | Obrigatória |
|------|-----------|---------|-------------|
| `DATABASE_URL` | Conexão PostgreSQL | - | Sim |
| `JWT_SECRET` | Assinatura JWT interno | - | Sim |
| `JWT_EXPIRES_IN` | Expiração JWT | `1d` | Não |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | - | Sim (se usar upload) |
| `CLOUDINARY_API_KEY` | Cloudinary | - | Sim |
| `CLOUDINARY_API_SECRET` | Cloudinary | - | Sim |
| `PAYMENT_WEBHOOK_SECRET` | Segredo HMAC do webhook de pagamentos | - | Sim (webhook) |
| `SALES_SERVICE_URL` | Base URL microserviço de vendas | `http://localhost:3001` | Não |

Exemplo `.env` (não commitar valores reais):

```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=trocar_depois
JWT_EXPIRES_IN=1d
PAYMENT_WEBHOOK_SECRET=coloque_um_hex_ou_base64_forte
SALES_SERVICE_URL=http://localhost:3001
```

Gerar segredo forte (PowerShell):

```powershell
[byte[]]$b=New-Object byte[] 32; (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($b); ($b | ForEach-Object { $_.ToString("x2") }) -join ""
```

---

## 🧩 Estrutura do Banco (Webhook)

Tabela `payment_webhook_events`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| evento_id | varchar | ID externo do evento (UNIQUE) |
| dados | jsonb | Payload recebido completo |
| criado_em | timestamptz | Carimbo de criação |

Migrations: usar `npm run build` seguido de comando TypeORM (`npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts`).

---

## 🚀 Execução Rápida

```
npm install
npm run start:dev
```

## 🛡️ Melhoria Futura (Roadmap Curto)

- Fila de retry de forward (Bull / Redis) para eventos de pagamento.
- Métricas (Prometheus) de contagem de eventos, duplicados e falhas de forward.
- Suporte a rotação dupla de segredos HMAC (`PRIMARY`/`SECONDARY`).
- Hardening de headers de segurança (Helmet) e rate limiting para o endpoint de webhook.

---

## 🤝 Contribuição

1. Crie branch: `git checkout -b feature/nome-feature`
2. Commits pequenos e descritivos
3. Abra PR apontando para `develop-test` (ou main conforme fluxo)
4. Garantir testes ≥ 80% e lint sem erros

---

## 📄 Licença

Projeto acadêmico – uso interno educacional. Ajuste a licença conforme necessidade antes de produção.

---

## 🔒 Segurança e Segredos

- Nunca commitar arquivos `.env` com credenciais reais (o repositório já ignora por padrão).
- Use GitHub Secrets para: `DATABASE_URL`, `JWT_SECRET`, `SONAR_TOKEN`, chaves Cloudinary e qualquer token externo.
- Rotacione segredos expostos imediatamente (caso algum tenha sido commitado antes).
- Tokens de análise (Sonar / Codecov) não devem ser reutilizados entre projetos.
- Em produção utilize usuários de banco com permissões mínimas (princípio do menor privilégio).
- Evite logs contendo tokens ou senhas.

Checklist rápido:
1. `SONAR_TOKEN` definido apenas em Secrets.
2. `JWT_SECRET` diferente para ambientes dev/stage/prod.
3. Usuário do banco sem permissões de DROP em produção (se possível).
4. Revisar histórico para remoção de segredos expostos (BFG ou git filter-repo se necessário).
5. Habilitar branch protection em `main` exigindo status da pipeline.

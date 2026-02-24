# Backend - WhatsApp Group Sender

Node.js + Express + TypeScript + Prisma + PostgreSQL

## Pré-requisitos

- Node.js 18+ (ou 20+)
- PostgreSQL
- npm

## Instalação

```bash
npm install
```

## Configuração do banco

Crie o arquivo `.env` na raiz do backend (ou copie de `.env.example`):

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_banco?schema=public
JWT_SECRET=sua-chave-secreta
# ... demais variáveis
```

## Comandos principais

### Desenvolvimento (modo dev com hot reload)

```bash
npm run dev
```

Inicia o servidor em `http://localhost:4250` (ou `PORT` do `.env`). Alterações no código reiniciam o processo automaticamente.

### Build (compilar TypeScript)

```bash
npm run build
```

Compila `src/` para `dist/`. Necessário antes de rodar em produção.

### Iniciar em produção

```bash
npm run build
npm start
```

### Prisma (banco de dados)

| Comando | Descrição |
|---------|-----------|
| `npm run prisma:generate` | Gera o cliente Prisma |
| `npm run prisma:migrate` | Cria/aplica migrations (modo dev) |
| `npm run db:migrate:deploy` | Aplica migrations em produção |

### Seed (admin inicial)

```bash
npm run build
npm run seed:admin
```

### Setup completo (primeira vez)

```bash
npm run setup
```

Executa: migrate deploy → generate → build → seed admin

## Fluxo ao alterar algo

1. **Durante o desenvolvimento:**
   ```bash
   npm run dev
   ```
   Edite os arquivos em `src/`. O servidor reinicia sozinho.

2. **Para gerar build de produção (ex.: antes de subir para o servidor):**
   ```bash
   npm run build
   ```
   O resultado fica em `dist/`. O PM2 usa `dist/index.js`.

3. **Se alterou o schema do Prisma (`prisma/schema.prisma`):**
   ```bash
   npx prisma migrate dev --name nome_da_mudanca
   npm run prisma:generate
   npm run build
   ```

4. **Se adicionou novas dependências:**
   ```bash
   npm install
   npm run build
   ```

## Estrutura relevante

```
backend/
├── src/
│   ├── routes/        # Rotas da API
│   ├── services/      # Lógica de negócio
│   ├── middleware/    # Auth, etc
│   ├── config/        # Env, etc
│   └── index.ts       # Entrada
├── prisma/
│   ├── schema.prisma  # Modelo do banco
│   └── migrations/   # Migrations
├── dist/              # Build (gerado)
└── .env               # Variáveis de ambiente
```

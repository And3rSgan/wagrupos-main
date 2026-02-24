# Migrations SQL

Migrations manuais no formato `YYYYMMDDHHMMSS-descricao.ts` para subir o schema do banco em uma VPS ou ambiente sem Prisma Migrate.

## Formato dos arquivos

Cada migration é um arquivo `.ts` que exporta `up` e `down`:

```ts
export const up = `CREATE TABLE ...`;
export const down = `DROP TABLE ...`;
```

## Como rodar

Na raiz do backend:

```bash
npm run db:migrate:sql
```

O script:
1. Cria a tabela `_db_migrations` se não existir
2. Lista os arquivos em `database/migrations/`
3. Executa o SQL `up` de cada migration que ainda não foi aplicada
4. Registra o nome da migration em `_db_migrations`

## Setup completo na VPS

```bash
npm install
npm run setup:sql
```

Isso executa migrations, gera o Prisma Client, faz o build e roda o seed do admin.

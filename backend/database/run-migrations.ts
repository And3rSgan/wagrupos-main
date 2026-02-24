/**
 * Runner de migrations SQL.
 * Uso: npm run db:migrate:sql
 *
 * Executa todos os arquivos .ts em database/migrations/ que ainda não foram aplicados,
 * em ordem pelo nome do arquivo (ex: 20260210194537-init.ts).
 */
import "dotenv/config";
import { Pool } from "pg";
import { readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "migrations");
const TABLE_NAME = "_db_migrations";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida em .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    // Criar tabela de controle se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${TABLE_NAME}" (
        "name" TEXT PRIMARY KEY,
        "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const applied = await pool.query(`SELECT "name" FROM "${TABLE_NAME}"`);
    const appliedSet = new Set((applied.rows as { name: string }[]).map((r) => r.name));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".ts") && /^\d{14}-.+\.ts$/.test(f))
      .sort();

    if (files.length === 0) {
      console.log("Nenhuma migration encontrada.");
      return;
    }

    for (const file of files) {
      const name = file.replace(/\.ts$/, "");
      if (appliedSet.has(name)) {
        console.log(`  [skip] ${name}`);
        continue;
      }

      const mod = require(join(MIGRATIONS_DIR, file));
      const sql: string = mod.up;
      if (!sql || typeof sql !== "string") {
        console.error(`  [erro] ${name}: export 'up' inválido`);
        process.exit(1);
      }

      try {
        await pool.query(sql);
        await pool.query(`INSERT INTO "${TABLE_NAME}" ("name") VALUES ($1)`, [name]);
        console.log(`  [ok]   ${name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [erro] ${name}:`, msg);
        process.exit(1);
      }
    }

    console.log("\nMigrations concluídas.");
  } finally {
    await pool.end();
  }
}

main();

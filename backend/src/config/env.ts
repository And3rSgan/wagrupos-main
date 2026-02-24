/**
 * Site: plwdesign.online | Autor: Santos PLW / Alex
 */
import dotenv from "dotenv";
import path from "path";

// Carrega variáveis de ambiente de backend/.env
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

// Se DATABASE_URL não foi informado diretamente, montamos a URL
// usando as variáveis de banco no formato (DB_*).
if (!process.env.DATABASE_URL) {
  const dialect = process.env.DB_DIALECT || "postgres";
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "postgres";
  const pass = process.env.DB_PASS || "123456";
  const name = process.env.DB_NAME || "post01";
  const url = `${dialect}ql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${name}?schema=public`;
  process.env.DATABASE_URL = url;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  backendUrl: process.env.BACKEND_URL || "http://localhost:4250",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  port: Number(process.env.PORT || 4250),
  db: {
    dialect: process.env.DB_DIALECT || "postgres",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    pass: process.env.DB_PASS || "123456",
    name: process.env.DB_NAME || "post01",
  },
  jwtSecret:
    process.env.JWT_SECRET || "changeme-in-production-access-token-secret",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    "changeme-in-production-refresh-token-secret",
  /** REDIS_URI tem prioridade; senão monta a partir de IO_REDIS_* (padrão Whaticket). Senha do Redis: IO_REDIS_PASSWORD ou DB_PASS. */
  redisUri: (() => {
    const uri = process.env.REDIS_URI?.trim();
    if (uri) return uri;
    const host = process.env.IO_REDIS_SERVER?.trim() || "127.0.0.1";
    const port = process.env.IO_REDIS_PORT?.trim() || "6379";
    const password = (process.env.IO_REDIS_PASSWORD ?? process.env.DB_PASS)?.trim() || "";
    const db = process.env.IO_REDIS_DB_SESSION?.trim() || "0";
    const auth = password ? `:${encodeURIComponent(password)}@` : "";
    return `redis://${auth}${host}:${port}/${db}`;
  })(),
  redisLimiterMax: Number(process.env.REDIS_OPT_LIMITER_MAX || 1),
  redisLimiterDuration: Number(process.env.REDIS_OPT_LIMITER_DURATION || 3000),
  /** Concorrência do worker de sync de grupos (1 = um sync por vez, menos CPU). */
  syncConcurrency: Math.max(1, Math.min(5, Number(process.env.SYNC_CONCURRENCY || 1))),
  /** Concorrência do worker de init de sessões WhatsApp (1–2 recomendado). */
  initConcurrency: Math.max(1, Math.min(4, Number(process.env.INIT_CONCURRENCY || 1))),
  userLimit: Number(process.env.USER_LIMIT || 10000),
  connectionsLimit: Number(process.env.CONNECTIONS_LIMIT || 100000),
  closedSendByMe: process.env.CLOSED_SEND_BY_ME === "true",
  corsOrigin:
    process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173",
  /** Níveis de log exibidos (separados por vírgula). Ex: WARN,SUCCESS,ERROR ou INFO,WARN,ERROR,SUCCESS */
  logLevel:
    process.env.LOG_LEVEL?.trim() ||
    (process.env.NODE_ENV === "production" ? "WARN,SUCCESS,ERROR" : "INFO,WARN,ERROR,SUCCESS"),
  security: {
    rateLimitGeneral: Number(process.env.RATE_LIMIT_GENERAL || 100),
    rateLimitAuth: Number(process.env.RATE_LIMIT_AUTH || 10),
    rateLimitRegister: Number(process.env.RATE_LIMIT_REGISTER || 5),
    rateLimitSensitive: Number(process.env.RATE_LIMIT_SENSITIVE || 30),
    enableBlocklist: process.env.SECURITY_BLOCKLIST === "true",
    blocklistIps: (process.env.BLOCKLIST_IPS || "").split(",").filter(Boolean),
  },
};

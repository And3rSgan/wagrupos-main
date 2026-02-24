# Módulo de Segurança Cibernética

Proteções implementadas contra invasões, uso indevido de API, DDoS, ataques ao banco e demais ameaças.

## Proteções Ativas

### 1. Rate Limiting (Anti-DDoS e Brute-Force)
- **Geral**: 100 req/min por IP (configurável via `RATE_LIMIT_GENERAL`)
- **Login**: 10 tentativas falhas / 15 min por IP
- **Registro**: 5 cadastros / hora por IP
- **APIs sensíveis** (campanhas, webhooks): 30 req/min por IP

### 2. Headers de Segurança (Helmet)
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- HSTS (produção)
- X-XSS-Protection
- Referrer-Policy

### 3. Validação de Requisições
- Detecção de **SQL Injection** em query params e body
- Detecção de **Path Traversal** (../, %2e%2e%2f)
- Bloqueio automático e registro em log

### 4. Sanitização de Entrada
- Remoção de scripts (`<script>`, `javascript:`)
- Remoção de event handlers (`onclick=`, etc)
- Remoção de caracteres de controle
- Proteção contra XSS em campos de texto

### 5. HTTP Parameter Pollution (HPP)
- Previne injeção de parâmetros duplicados
- Usa último valor quando há duplicatas

### 6. Limite de Payload
- Body limitado a 2MB (anti DoS por payload grande)

### 7. Blocklist de IPs (estática + dinâmica)
- **Estática**: IPs em `BLOCKLIST_IPS` (opcional)
- **Dinâmica**: IPs que fazem várias requisições de scan/ataque (PHPUnit, ThinkPHP, Docker API, path traversal, etc.) são bloqueados automaticamente após 3 tentativas em 5 minutos. Bloqueio em Redis (7 dias) ou em memória se Redis indisponível. Reduz ruído no log (404 de scan não viram WARN).

## Variáveis de Ambiente (.env)

```env
# Rate Limits
RATE_LIMIT_GENERAL=100
RATE_LIMIT_AUTH=10
RATE_LIMIT_REGISTER=5
RATE_LIMIT_SENSITIVE=30

# Blocklist estática (opcional). Dinâmica (por scan) é sempre ativa.
BLOCKLIST_IPS=192.168.1.100,10.0.0.50
```

## Logs de Segurança

Eventos registrados em `SECURITY`:
- `[BRUTE-FORCE]` - Tentativas de login/registro excessivas
- `[THROTTLE]` - Rate limit excedido
- `[BLOCKED]` - IP bloqueado pela blocklist
- `[SQL-INJECTION]` - Tentativa de injeção SQL
- `[PATH-TRAVERSAL]` - Tentativa de path traversal

## Banco de Dados

- **Prisma** já usa queries parametrizadas (proteção nativa contra SQL injection)
- Conexões limitadas pelo pool do Prisma
- Sem exposição direta de queries raw ao cliente

## Proxy/Nginx

Configure `trust proxy` para que o IP real seja identificado atrás de Nginx:
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

O backend já usa `app.set("trust proxy", 1)`.

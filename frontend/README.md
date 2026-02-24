# Frontend - WhatsApp Group Sender

React + Vite + TypeScript + MUI

## Pré-requisitos

- Node.js 18+ (ou 20+)
- npm

## Instalação

```bash
npm install
```

## Comandos principais

### Desenvolvimento (modo dev com hot reload)

```bash
npm run dev
```

Inicia o servidor de desenvolvimento em `http://localhost:5173`. Alterações no código recarregam automaticamente no navegador.

### Build (gerar produção)

```bash
npm run build
```

Compila o projeto para a pasta `dist/`. Use isso antes de fazer deploy ou quando quiser testar a versão otimizada.

### Preview (testar build localmente)

```bash
npm run build
npm run preview
```

Serve o build de produção em `http://localhost:4173` para testar antes de publicar.

## Fluxo ao alterar algo

1. **Durante o desenvolvimento:**
   ```bash
   npm run dev
   ```
   Edite os arquivos em `src/`. O navegador atualiza sozinho.

2. **Para gerar build de produção (ex.: antes de subir para o servidor):**
   ```bash
   npm run build
   ```
   O resultado fica em `dist/`. O instalador/PM2 usa essa pasta para servir o frontend.

3. **Se adicionou novas dependências:**
   ```bash
   npm install
   ```

## Variáveis de ambiente

Configure em `frontend/config/.env` ou `frontend/config/.env.production`:

| Variável              | Descrição                         |
|-----------------------|-----------------------------------|
| `VITE_API_BASE_URL`   | URL da API (ex: `http://localhost:4250/api`) |
| `REACT_APP_BACKEND_URL` | Alternativa para URL do backend |

## Estrutura relevante

```
frontend/
├── src/
│   ├── pages/         # Páginas da aplicação
│   ├── components/    # Componentes reutilizáveis
│   ├── api.ts         # Configuração do axios
│   └── main.tsx       # Entrada
├── config/            # .env, .env.production
└── dist/              # Build de produção (gerado)
```

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  // Faz o Vite ler as variáveis de ambiente a partir de frontend/config/.env
  envDir: "config",
  // Expõe também REACT_APP_* no import.meta.env (compatível com o formato pedido)
  envPrefix: ["VITE_", "REACT_APP_"],
  server: {
    port: 5173,
    proxy: {
      // Proxy para assets do backend (logo, favicon, uploads)
      "/public": { target: "http://localhost:4250", changeOrigin: true },
      "/uploads": { target: "http://localhost:4250", changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
  },
});


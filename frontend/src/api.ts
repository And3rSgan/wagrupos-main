import axios from "axios";

// Suporta tanto Vite (VITE_*) quanto o formato pedido (REACT_APP_BACKEND_URL)
const envAny = import.meta.env as any;

const API_BASE_URL =
  envAny.VITE_API_BASE_URL ||
  envAny.REACT_APP_BACKEND_URL ||
  "http://localhost:8080/api";

/** URL base do backend (sem /api) para assets estáticos */
export function getBackendBaseUrl(): string {
  const u = API_BASE_URL.replace(/\/api\/?$/, "");
  return u || (typeof window !== "undefined" ? window.location.origin : "");
}

/** Monta URL para mídia (imagens de produtos, campanhas, etc.) */
export function getMediaUrl(filePath: string | null | undefined): string {
  if (!filePath) return "";
  if (filePath.startsWith("http")) return filePath;
  const path = filePath.replace(/^\//, "");
  // Em dev (Vite) usa path relativo para passar pelo proxy /uploads -> backend
  const base = getBackendBaseUrl();
  const isDev = import.meta.env?.DEV;
  if (isDev) {
    return `/${path}`;
  }
  return base ? `${base.replace(/\/$/, "")}/${path}` : `/${path}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Evita vazamento de URLs da API e dados sensíveis no console em caso de erro
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.config) {
      try {
        const c = err.config as Record<string, unknown>;
        if (c.baseURL) c.baseURL = "[redacted]";
        if (c.url) c.url = "[redacted]";
        if (c.headers && typeof c.headers === "object") {
          const h = c.headers as Record<string, unknown>;
          if ("Authorization" in h) h.Authorization = "[redacted]";
        }
      } catch (_) {}
    }
    return Promise.reject(err);
  }
);

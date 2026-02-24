import { useEffect, useState } from "react";
import { api } from "../api";

export type RecaptchaPublicConfig = {
  enabled: boolean;
  version: null | "v2" | "v3";
  siteKey: string | null;
};

const RECAPTCHA_SCRIPT = "https://www.google.com/recaptcha/api.js";

export function useRecaptchaConfig(): {
  config: RecaptchaPublicConfig | null;
  loading: boolean;
} {
  const [config, setConfig] = useState<RecaptchaPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<RecaptchaPublicConfig>("/settings/recaptcha-public")
      .then((r) => setConfig(r.data))
      .catch(() => setConfig({ enabled: false, version: null, siteKey: null }))
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}

function loadRecaptchaScript(siteKey: string | null, version: "v2" | "v3"): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const scriptId = version === "v3" ? "recaptcha-api-script-v3" : "recaptcha-api-script-v2";
  if (document.getElementById(scriptId)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src =
      version === "v3" && siteKey
        ? `${RECAPTCHA_SCRIPT}?render=${encodeURIComponent(siteKey)}`
        : RECAPTCHA_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar reCAPTCHA"));
    document.head.appendChild(script);
  });
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      getResponse: () => string;
      render: (container: string | HTMLElement, options: { sitekey: string; size?: string; callback?: (token: string) => void }) => number;
    };
  }
}

export async function getRecaptchaTokenV3(siteKey: string, action: string): Promise<string | null> {
  await loadRecaptchaScript(siteKey, "v3");
  const g = window.grecaptcha;
  if (!g) return null;
  return new Promise((resolve) => {
    g.ready(() => {
      g.execute(siteKey, { action })
        .then(resolve)
        .catch(() => resolve(null));
    });
  });
}

function waitForElement(id: string, maxAttempts = 10, intervalMs = 100): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const el = document.getElementById(id);
    if (el) {
      resolve(el);
      return;
    }
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      const e = document.getElementById(id);
      if (e) {
        clearInterval(t);
        resolve(e);
      } else if (attempts >= maxAttempts) {
        clearInterval(t);
        resolve(null);
      }
    }, intervalMs);
  });
}

export function useRecaptchaV2Widget(containerId: string, siteKey: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !siteKey || !containerId) return;

    let cancelled = false;

    (async () => {
      await loadRecaptchaScript(null, "v2");
      if (cancelled) return;
      const el = await waitForElement(containerId);
      if (cancelled || !el || el.hasChildNodes()) return;
      const g = window.grecaptcha;
      if (!g) return;
      if (typeof g.ready === "function") {
        g.ready(() => {
          if (cancelled) return;
          const container = document.getElementById(containerId);
          if (!container || container.hasChildNodes()) return;
          g.render(containerId, { sitekey: siteKey, size: "normal" });
        });
      } else {
        g.render(containerId, { sitekey: siteKey, size: "normal" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, siteKey, containerId]);
}

export function getRecaptchaTokenV2(): string | null {
  const g = window.grecaptcha;
  return g ? g.getResponse() : null;
}

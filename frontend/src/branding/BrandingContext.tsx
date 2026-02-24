import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getBackendBaseUrl } from "../api";

export type Branding = {
  systemTitle: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  iconUrl: string | null;
};

type BrandingContextValue = Branding & { refresh: () => void };

const defaultBranding: Branding = {
  systemTitle: "Painel de disparos WhatsApp",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  iconUrl: null,
};

const BrandingContext = createContext<BrandingContextValue>({ ...defaultBranding, refresh: () => {} });

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  const refresh = useCallback(() => {
    api
      .get<Branding>("/settings/branding")
      .then((r) => {
        const ts = Date.now(); // cache-bust para evitar exibir imagem em cache antiga
        const base = getBackendBaseUrl();
        // Path relativo (/public/...) usa proxy em dev; em produção usa base do backend
        const toFull = (url: string | null) => {
          if (!url) return null;
          return url.startsWith("http") ? url : base + url;
        };
        const logoPath = toFull(r.data.logoUrl);
        const logoDarkPath = toFull(r.data.logoDarkUrl ?? null);
        const faviconPath = toFull(r.data.faviconUrl);
        const iconPath = toFull(r.data.iconUrl ?? null);
        setBranding({
          systemTitle: r.data.systemTitle,
          logoUrl: logoPath ? `${logoPath}?v=${ts}` : null,
          logoDarkUrl: logoDarkPath ? `${logoDarkPath}?v=${ts}` : null,
          faviconUrl: faviconPath ? `${faviconPath}?v=${ts}` : null,
          iconUrl: iconPath ? `${iconPath}?v=${ts}` : null,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    document.title = branding.systemTitle;
  }, [branding.systemTitle]);

  useEffect(() => {
    if (!branding.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding.faviconUrl]);

  return <BrandingContext.Provider value={{ ...branding, refresh }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

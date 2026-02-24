const SYSTEM_TITLE_KEY = "system_title";

export const DEFAULT_SYSTEM_TITLE = "Painel de disparos WhatsApp";

export function getSystemTitle() {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_TITLE;
  const saved = window.localStorage.getItem(SYSTEM_TITLE_KEY)?.trim();
  return saved || DEFAULT_SYSTEM_TITLE;
}

export function setSystemTitle(title: string) {
  if (typeof window === "undefined") return;
  const normalized = title.trim();
  if (normalized) {
    window.localStorage.setItem(SYSTEM_TITLE_KEY, normalized);
  } else {
    window.localStorage.removeItem(SYSTEM_TITLE_KEY);
  }
  window.dispatchEvent(new Event("system-title-changed"));
}

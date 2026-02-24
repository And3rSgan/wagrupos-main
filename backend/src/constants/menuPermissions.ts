/** Chaves dos menus - usadas para controle de permissões por usuário */
export const MENU_KEYS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "whatsapp_connection", label: "Conexões WhatsApp" },
  { key: "whatsapp_groups", label: "Disparo em grupos" },
  { key: "groups", label: "Grupos" },
  { key: "products", label: "Produtos e Criativos" },
  { key: "templates", label: "Templates" },
  { key: "types", label: "Tipos" },
  { key: "campaigns", label: "Campanhas" },
  { key: "settings", label: "Configurações" },
  { key: "invoices", label: "Faturas" },
  { key: "admin_users", label: "Usuários (Admin)" },
] as const;

export type MenuKey = (typeof MENU_KEYS)[number]["key"];
export const MENU_KEYS_LIST = MENU_KEYS.map((m) => m.key);

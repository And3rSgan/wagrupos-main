import type { Me } from "../auth/AuthContext";

/** Mapeamento path -> menuKey */
export const PATH_TO_MENU: Record<string, string> = {
  "/dashboard": "dashboard",
  "/whatsapp/connection": "whatsapp_connection",
  "/whatsapp/groups": "whatsapp_groups",
  "/groups": "groups",
  "/products": "products",
  "/templates": "templates",
  "/types": "types",
  "/campaigns": "campaigns",
  "/me": "me",
  "/settings": "settings",
  "/invoices": "invoices",
  "/admin/users": "admin_users",
  "/admin/companies": "admin_companies",
  "/admin/plans": "admin_plans",
  "/help": "help",
};

/** Menus sempre permitidos */
const ALWAYS_ALLOWED = ["me", "help"];

/**
 * Verifica se o usuário pode acessar o menu pela key.
 * Configurações (settings): SuperAdmin vê tudo; usuários com empresa veem só delay dos disparos.
 */
export function canAccessMenu(me: Me | null, menuKey: string): boolean {
  if (!me) return false;
  if (ALWAYS_ALLOWED.includes(menuKey)) return true;
  if (me.role === "SUPERADMIN") return true;
  if (menuKey === "settings" && me.companyId) return true;

  const perms = me.menuPermissions;
  if (!perms || !Array.isArray(perms)) {
    return hasDefaultAccess(me.role, menuKey);
  }
  return perms.includes(menuKey);
}

/** Ordem das rotas do painel (primeira página para Supervisor/User) */
const PANEL_ROUTES_ORDER = [
  "/dashboard",
  "/groups",
  "/products",
  "/templates",
  "/types",
  "/campaigns",
];

/**
 * Retorna a rota padrão após login baseada no role.
 * SUPERADMIN e ADMIN → dashboard
 * SUPERVISOR e USER → primeira página do painel que têm acesso
 */
export function getDefaultRouteAfterLogin(me: Me | null): string {
  if (!me) return "/dashboard";
  if (me.role === "SUPERADMIN" || me.role === "ADMIN") return "/dashboard";

  for (const path of PANEL_ROUTES_ORDER) {
    const menuKey = PATH_TO_MENU[path];
    if (menuKey && canAccessMenu(me, menuKey)) return path;
  }
  return "/dashboard";
}

/**
 * Acesso padrão por role quando menuPermissions não está definido.
 */
function hasDefaultAccess(role: string, menuKey: string): boolean {
  const superAdminOnly = ["admin_companies", "admin_plans", "settings"];
  const companyAdminOnly = ["admin_users"];
  const connectionManagement = ["whatsapp_connection", "whatsapp_groups"];
  if (role === "ADMIN") {
    return !superAdminOnly.includes(menuKey);
  }
  if (role === "SUPERVISOR" || role === "USER") {
    return (
      !superAdminOnly.includes(menuKey) &&
      !companyAdminOnly.includes(menuKey) &&
      !connectionManagement.includes(menuKey)
    );
  }
  return false;
}

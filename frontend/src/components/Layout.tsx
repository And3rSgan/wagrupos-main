import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canAccessMenu } from "../utils/menuPermissions";
import { useBranding } from "../branding/BrandingContext";
import { useTheme } from "../theme/ThemeContext";
import { getSystemTitle } from "../systemSettings";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import HubOutlined from "@mui/icons-material/HubOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import ViewModuleOutlined from "@mui/icons-material/ViewModuleOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import ReceiptOutlined from "@mui/icons-material/ReceiptOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import BusinessOutlined from "@mui/icons-material/BusinessOutlined";
import ViewListOutlined from "@mui/icons-material/ViewListOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";

function MenuItem({
  to,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => "zest-menu-item" + (isActive ? " active" : "")}
    >
      <span className="zest-menu-icon">{icon}</span>
      <span>{children}</span>
    </NavLink>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const branding = useBranding();
  const { mode, toggleMode } = useTheme();
  const effectiveLogoUrl = mode === "dark" && branding.logoDarkUrl ? branding.logoDarkUrl : branding.logoUrl;
  const sidebarIconUrl = branding.iconUrl || branding.faviconUrl;
  const systemTitle = branding.systemTitle || getSystemTitle();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const isRestricted =
    me?.subscription?.isTrialExpired && !me?.subscription?.hasActivePaidAccess && me?.companyId;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function toggleSidebar() {
    if (isMobile) {
      setMobileMenuOpen((o) => !o);
    } else {
      setSidebarCollapsed((c) => !c);
    }
  }

  function closeMobileMenu() {
    if (isMobile) setMobileMenuOpen(false);
  }

  return (
    <div className="zest-wrapper">
      {isMobile && mobileMenuOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={closeMobileMenu}
          onKeyDown={(e) => e.key === "Escape" && closeMobileMenu()}
          aria-label="Fechar menu"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1025,
          }}
        />
      )}
      <aside
        className={`zest-sidebar ${sidebarCollapsed && !isMobile ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}
        style={isMobile ? { zIndex: 1030 } : undefined}
      >
        <div className="zest-logo">
          <Link to="/">
            {sidebarCollapsed ? (
              sidebarIconUrl ? (
                <img src={sidebarIconUrl} alt={systemTitle} style={{ width: 48, height: 48, objectFit: "contain" }} />
              ) : (
                <span className="zest-logo-initial">{systemTitle.charAt(0).toUpperCase()}</span>
              )
            ) : effectiveLogoUrl ? (
              <img src={effectiveLogoUrl} alt={systemTitle} style={{ maxHeight: 64, maxWidth: 220, objectFit: "contain" }} />
            ) : (
              <span>{systemTitle}</span>
            )}
          </Link>
        </div>
        <nav className="zest-menu">
          {!isRestricted && (
            <>
              <span className="zest-menu-title">Painel</span>
              {canAccessMenu(me, "dashboard") && (
                <MenuItem to="/dashboard" icon={<DashboardOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Dashboard
                </MenuItem>
              )}
              {canAccessMenu(me, "whatsapp_connection") && (
                <MenuItem to="/whatsapp/connection" icon={<HubOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Conexões
                </MenuItem>
              )}
              {canAccessMenu(me, "whatsapp_groups") && (
                <MenuItem to="/whatsapp/groups" icon={<SendOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Disparo em grupos
                </MenuItem>
              )}
              {canAccessMenu(me, "groups") && (
                <MenuItem to="/groups" icon={<GroupOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Grupos
                </MenuItem>
              )}
              {canAccessMenu(me, "products") && (
                <MenuItem to="/products" icon={<Inventory2Outlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Produtos e Criativos
                </MenuItem>
              )}
              {canAccessMenu(me, "templates") && (
                <MenuItem to="/templates" icon={<ViewModuleOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Templates
                </MenuItem>
              )}
              {canAccessMenu(me, "types") && (
                <MenuItem to="/types" icon={<CategoryOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Tipos
                </MenuItem>
              )}
              {canAccessMenu(me, "campaigns") && (
                <MenuItem to="/campaigns" icon={<CampaignOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                  Campanhas
                </MenuItem>
              )}
            </>
          )}

          <span className="zest-menu-title" style={{ marginTop: 18 }}>Conta</span>
          <MenuItem to="/me" icon={<PersonOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
            Minha conta
          </MenuItem>
          {!isRestricted && canAccessMenu(me, "settings") && (
            <MenuItem to="/settings" icon={<SettingsOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
              Configuracoes
            </MenuItem>
          )}
          {me?.companyId && canAccessMenu(me, "invoices") && (
            <MenuItem to="/invoices" icon={<ReceiptOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
              Faturas
            </MenuItem>
          )}

          {!isRestricted && canAccessMenu(me, "admin_users") && (
            <>
              <span className="zest-menu-title" style={{ marginTop: 18 }}>Admin</span>
              <MenuItem to="/admin/users" icon={<PeopleOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                Usuarios
              </MenuItem>
              {me?.role === "SUPERADMIN" && (
                <>
                  <MenuItem to="/admin/companies" icon={<BusinessOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                    Empresas
                  </MenuItem>
                  <MenuItem to="/admin/plans" icon={<ViewListOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                    Planos
                  </MenuItem>
                  <MenuItem to="/admin/invoices" icon={<ReceiptOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
                    Central de Faturas
                  </MenuItem>
                </>
              )}
            </>
          )}

          <span className="zest-menu-title" style={{ marginTop: 18 }}>Ajuda</span>
          <MenuItem to="/help" icon={<HelpOutlineOutlined sx={{ fontSize: 20 }} />} onNavigate={closeMobileMenu}>
            Como usar
          </MenuItem>
        </nav>
      </aside>

      <div className="zest-main">
        <header className="zest-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, flex: 1 }}>
            <Tooltip title={isMobile ? "Menu" : sidebarCollapsed ? "Expandir menu" : "Recolher menu"}>
              <IconButton size="small" onClick={toggleSidebar} sx={{ flexShrink: 0 }}>
                <MenuIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <div className="zest-topbar-title" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                Olá {me?.name || me?.email?.split("@")[0] || "Usuário"}
                {!isMobile && (me?.company ? <>, Bem-vindo a {me.company.name}!</> : <>, Bem-vindo!</>)}
              </span>
              {me?.subscription?.currentPeriodEnd && (
                <small style={{ color: "var(--zest-text-secondary)", fontWeight: 400, display: "block", marginTop: 1, fontSize: "inherit" }}>
                  Válido até {new Date(me.subscription.currentPeriodEnd).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </small>
              )}
            </div>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            <Tooltip title={mode === "dark" ? "Modo claro" : "Modo escuro"}>
              <IconButton size="small" onClick={toggleMode}>
                {mode === "dark" ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
              </IconButton>
            </Tooltip>
            {me?.role && !isMobile && <Chip label={me.role} size="small" color="primary" variant="outlined" sx={{ fontWeight: 500 }} />}
            {isMobile ? (
              <Tooltip title="Sair">
                <IconButton size="small" onClick={handleLogout} color="primary">
                  <LogoutOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Button variant="outlined" size="small" onClick={handleLogout} color="primary" startIcon={<LogoutOutlined fontSize="small" />}>
                Sair
              </Button>
            )}
          </Box>
        </header>
        <main className="zest-content">
          <Outlet />
        </main>
        <footer className="zest-footer" style={{ textAlign: "center" }}>
          <small>© {new Date().getFullYear()} • Desenvolvido por PLW Design</small>
        </footer>
      </div>
    </div>
  );
}

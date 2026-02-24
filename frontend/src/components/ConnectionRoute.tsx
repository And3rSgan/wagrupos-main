import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../toast/ToastContext";
import { canAccessMenu } from "../utils/menuPermissions";

interface Props {
  children: ReactNode;
  menuKey: "whatsapp_connection" | "whatsapp_groups";
}

/**
 * Protege rotas de conexão (Conexões e Disparo em grupos).
 * Apenas ADMIN e SUPERADMIN podem acessar. USER e SUPERVISOR são redirecionados.
 */
export function ConnectionRoute({ children, menuKey }: Props) {
  const location = useLocation();
  const { me, loading } = useAuth();
  const toast = useToast();
  const warnedRef = useRef(false);

  const hasAccess = canAccessMenu(me, menuKey);

  useEffect(() => {
    if (!loading && me && !hasAccess && !warnedRef.current) {
      warnedRef.current = true;
      toast.push({
        type: "warning",
        title: "Acesso restrito",
        message: "Conexões WhatsApp são gerenciadas apenas pelo administrador da empresa.",
      });
    }
  }, [loading, me, hasAccess, toast]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (!me) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

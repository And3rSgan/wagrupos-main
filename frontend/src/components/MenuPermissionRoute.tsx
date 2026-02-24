import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../toast/ToastContext";
import { canAccessMenu } from "../utils/menuPermissions";
import { PATH_TO_MENU } from "../utils/menuPermissions";

interface Props {
  children: ReactNode;
  path: string;
}

/**
 * Protege rotas por permissão de menu.
 * Se o usuário não tiver permissão, emite aviso e redireciona para o dashboard.
 */
export function MenuPermissionRoute({ children, path }: Props) {
  const location = useLocation();
  const { me, loading } = useAuth();
  const toast = useToast();
  const warnedRef = useRef(false);

  const menuKey = PATH_TO_MENU[path] || path.replace(/^\//, "").replace(/\//g, "_");
  const hasAccess = canAccessMenu(me, menuKey);

  useEffect(() => {
    if (!loading && me && !hasAccess && !warnedRef.current) {
      warnedRef.current = true;
      toast.push({
        type: "warning",
        title: "Acesso restrito",
        message: "Você não tem permissão para acessar esta página.",
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

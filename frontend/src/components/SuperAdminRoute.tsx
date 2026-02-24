import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../toast/ToastContext";

interface Props {
  children: ReactNode;
}

/**
 * Protege rotas exclusivas do SuperAdmin.
 * Se outra empresa ou usuário não-SuperAdmin tentar acessar, emite aviso e redireciona para o dashboard.
 */
export function SuperAdminRoute({ children }: Props) {
  const location = useLocation();
  const { me, loading } = useAuth();
  const toast = useToast();
  const warnedRef = useRef(false);

  const isSuperAdmin = me?.role === "SUPERADMIN";

  useEffect(() => {
    if (!loading && me && !isSuperAdmin && !warnedRef.current) {
      warnedRef.current = true;
      toast.push({
        type: "warning",
        title: "Acesso restrito",
        message: "Esta área é exclusiva para o administrador do sistema.",
      });
    }
  }, [loading, me, isSuperAdmin, toast]);

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

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

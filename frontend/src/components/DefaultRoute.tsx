import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRouteAfterLogin } from "../utils/menuPermissions";

/**
 * Redireciona / para a rota padrão baseada no role do usuário.
 * SUPERADMIN e ADMIN → dashboard
 * SUPERVISOR e USER → primeira página do painel
 */
export function DefaultRoute() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  const target = me ? getDefaultRouteAfterLogin(me) : "/dashboard";
  return <Navigate to={target} replace />;
}

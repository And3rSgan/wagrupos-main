import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ALLOWED_WHEN_RESTRICTED = ["/invoices", "/me"];

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { me } = useAuth();
  const path = location.pathname;

  const isRestricted =
    me?.subscription?.isTrialExpired && !me?.subscription?.hasActivePaidAccess && me?.companyId;
  const isAllowed = ALLOWED_WHEN_RESTRICTED.some((p) => path === p || path.startsWith(p + "/"));

  if (isRestricted && !isAllowed) {
    return <Navigate to="/invoices" replace state={{ restricted: true }} />;
  }

  return <>{children}</>;
}

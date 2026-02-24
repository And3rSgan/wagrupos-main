import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

export type UserRole = "SUPERADMIN" | "ADMIN" | "SUPERVISOR" | "USER";

export interface SubscriptionInfo {
  trialEndsAt: string | null;
  isTrialExpired: boolean;
  hasActivePaidAccess: boolean;
  currentPeriodEnd: string;
  billingDay: number;
}

export interface Me {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  companyId?: string | null;
  menuPermissions?: string[] | null;
  company?: { id: string; name: string; slug: string } | null;
  subscription?: SubscriptionInfo | null;
}

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  refreshMe: (opts?: { silent?: boolean }) => Promise<Me | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe(opts?: { silent?: boolean }): Promise<Me | null> {
    const token = window.localStorage.getItem("auth_token");
    if (!token) {
      setMe(null);
      setLoading(false);
      return null;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const res = await api.get<Me>("/auth/me");
      setMe(res.data);
      return res.data;
    } catch {
      setMe(null);
      window.localStorage.removeItem("auth_token");
      return null;
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("auth_token");
    setMe(null);
  }

  useEffect(() => {
    void refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ me, loading, refreshMe, logout }),
    [me, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


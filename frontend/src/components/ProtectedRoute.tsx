import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const location = useLocation();
  const { loading } = useAuth();
  const token = window.localStorage.getItem("auth_token");

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}


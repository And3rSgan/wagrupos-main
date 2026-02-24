import { FormEvent, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Link from "@mui/material/Link";
import { api } from "../api";
import { useToast } from "../toast/ToastContext";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";
import { useTheme } from "../theme/ThemeContext";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import { getDefaultRouteAfterLogin } from "../utils/menuPermissions";
import { useRecaptchaConfig, getRecaptchaTokenV3, getRecaptchaTokenV2, useRecaptchaV2Widget } from "../recaptcha/useRecaptcha";

export default function LoginPage() {
  const branding = useBranding();
  const { mode, toggleMode } = useTheme();
  const effectiveLogo = mode === "dark" && branding.logoDarkUrl ? branding.logoDarkUrl : branding.logoUrl;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshMe } = useAuth();
  const { config: recaptchaConfig } = useRecaptchaConfig();
  const recaptchaEnabled = !!recaptchaConfig?.enabled && !!recaptchaConfig?.siteKey && (recaptchaConfig?.version === "v2" || recaptchaConfig?.version === "v3");
  useRecaptchaV2Widget("recaptcha-login-container", recaptchaConfig?.siteKey ?? "", recaptchaEnabled && recaptchaConfig?.version === "v2");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let recaptchaToken: string | null = null;
      if (recaptchaEnabled && recaptchaConfig?.siteKey) {
        if (recaptchaConfig.version === "v3") {
          recaptchaToken = await getRecaptchaTokenV3(recaptchaConfig.siteKey, "login");
        } else {
          recaptchaToken = getRecaptchaTokenV2();
        }
        if (!recaptchaToken) {
          setError(recaptchaConfig.version === "v2" ? "Marque a verificação \"Não sou um robô\"." : "Verificação de segurança falhou. Tente novamente.");
          setLoading(false);
          return;
        }
      }
      const payload: { email: string; password: string; recaptchaToken?: string } = { email, password };
      if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
      const res = await api.post("/auth/login", payload);
      window.localStorage.setItem("auth_token", res.data.token);
      const me = await refreshMe();
      toast.push({ type: "success", title: "Login", message: "Bem-vindo!" });
      const redirectTo = me ? getDefaultRouteAfterLogin(me) : "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        "Erro ao autenticar. Verifique suas credenciais.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        position: "relative",
      }}
    >
      <Tooltip title={mode === "dark" ? "Modo claro" : "Modo escuro"}>
        <IconButton
          onClick={toggleMode}
          sx={{ position: "absolute", top: 16, right: 16 }}
        >
          {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
        </IconButton>
      </Tooltip>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          bgcolor: "background.paper",
          p: 3.5,
          borderRadius: 2,
          width: "100%",
          maxWidth: 360,
          boxShadow: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {effectiveLogo ? (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <img src={effectiveLogo} alt="Logo" style={{ maxHeight: 128, maxWidth: 320, objectFit: "contain" }} />
          </Box>
        ) : (
          <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
            {branding.systemTitle}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Entre com seu e-mail e senha
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} variant="filled">
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          sx={{ mb: 2 }}
          autoComplete="email"
        />
        <TextField
          fullWidth
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          sx={{ mb: 2 }}
          autoComplete="current-password"
        />
        {recaptchaEnabled && recaptchaConfig?.version === "v2" && (
          <Box id="recaptcha-login-container" sx={{ mb: 2, minHeight: 78 }} />
        )}
        <Button
          fullWidth
          type="submit"
          variant="contained"
          color="primary"
          size="medium"
          disabled={loading}
          sx={{ mt: 1 }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 2 }}>
          Não tem conta?{" "}
          <Link component={RouterLink} to="/register" color="primary" underline="hover">
            Criar conta
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}

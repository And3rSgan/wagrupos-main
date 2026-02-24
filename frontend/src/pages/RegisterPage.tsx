import { FormEvent, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Link from "@mui/material/Link";
import { api } from "../api";
import { useToast } from "../toast/ToastContext";
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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useRecaptchaConfig, getRecaptchaTokenV3, getRecaptchaTokenV2, useRecaptchaV2Widget } from "../recaptcha/useRecaptcha";

type Plan = { id: string; name: string; slug: string; price: number; limits: Record<string, number> };

export default function RegisterPage() {
  const branding = useBranding();
  const { mode, toggleMode } = useTheme();
  const effectiveLogo = mode === "dark" && branding.logoDarkUrl ? branding.logoDarkUrl : branding.logoUrl;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { config: recaptchaConfig } = useRecaptchaConfig();
  const recaptchaEnabled = !!recaptchaConfig?.enabled && !!recaptchaConfig?.siteKey && (recaptchaConfig?.version === "v2" || recaptchaConfig?.version === "v3");
  useRecaptchaV2Widget("recaptcha-register-container", recaptchaConfig?.siteKey ?? "", recaptchaEnabled && recaptchaConfig?.version === "v2");

  useEffect(() => {
    api.get<Plan[]>("/plans/public").then((r) => {
      setPlans(r.data);
      if (r.data.length > 0 && !planId) setPlanId(r.data[0].id);
    }).catch(() => setPlans([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Nome da empresa é obrigatório");
      return;
    }
    if (!planId || plans.length === 0) {
      setError(plans.length === 0 ? "Nenhum plano disponível. Contate o administrador." : "Selecione um plano");
      return;
    }
    let recaptchaToken: string | null = null;
    if (recaptchaEnabled && recaptchaConfig?.siteKey) {
      if (recaptchaConfig.version === "v3") {
        recaptchaToken = await getRecaptchaTokenV3(recaptchaConfig.siteKey, "register");
      } else {
        recaptchaToken = getRecaptchaTokenV2();
      }
      if (!recaptchaToken) {
        setError(recaptchaConfig.version === "v2" ? "Marque a verificação \"Não sou um robô\"." : "Verificação de segurança falhou. Tente novamente.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const payload: {
        email: string;
        password: string;
        name?: string;
        companyName: string;
        planId: string;
        recaptchaToken?: string;
      } = {
        email,
        password,
        name: name || undefined,
        companyName: companyName.trim(),
        planId,
      };
      if (recaptchaToken) payload.recaptchaToken = recaptchaToken;
      await api.post("/auth/register", payload);
      toast.push({ type: "success", title: "Cadastro", message: "Conta criada! Faça login." });
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", alignItems: "center", justifyContent: "center", p: 2, position: "relative" }}>
      <Tooltip title={mode === "dark" ? "Modo claro" : "Modo escuro"}>
        <IconButton onClick={toggleMode} sx={{ position: "absolute", top: 16, right: 16 }}>
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
          maxWidth: 400,
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
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#333", mb: 0.5 }}>
            {branding.systemTitle}
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: "#666", mb: 2 }}>
          Criar conta e empresa
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} variant="filled">
            {error}
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 2 }} required>
          <InputLabel>Plano</InputLabel>
          <Select
            value={planId}
            label="Plano"
            onChange={(e) => setPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} — R$ {p.price.toFixed(2)}/mês
              </MenuItem>
            ))}
            {plans.length === 0 && (
              <MenuItem value="" disabled>Nenhum plano disponível</MenuItem>
            )}
          </Select>
          {plans.length === 0 && (
            <Typography variant="caption" sx={{ mt: 0.5, color: "text.secondary" }}>
              Contate o administrador para criar planos.
            </Typography>
          )}
        </FormControl>

        <TextField
          fullWidth
          label="Nome da empresa"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          placeholder="Ex: Minha Loja"
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Opcional"
          sx={{ mb: 2 }}
        />
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
          helperText="Mínimo 6 caracteres"
          sx={{ mb: 2 }}
          autoComplete="new-password"
        />
        {recaptchaEnabled && recaptchaConfig?.version === "v2" && (
          <Box id="recaptcha-register-container" sx={{ mb: 2, minHeight: 78 }} />
        )}
        <Button fullWidth type="submit" variant="contained" color="primary" disabled={loading || plans.length === 0} sx={{ mt: 1 }}>
          {loading ? "Cadastrando..." : plans.length === 0 ? "Aguarde os planos..." : "Cadastrar"}
        </Button>

        <Typography variant="body2" sx={{ textAlign: "center", mt: 2, color: "#666" }}>
          Já tem conta?{" "}
          <Link component={RouterLink} to="/login" color="primary" underline="hover">
            Entrar
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}

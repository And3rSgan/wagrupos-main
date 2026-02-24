import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../toast/ToastContext";
import { useAuth } from "../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import ReceiptOutlined from "@mui/icons-material/ReceiptOutlined";
import SmartToyOutlined from "@mui/icons-material/SmartToyOutlined";
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";
import ScheduleSendOutlined from "@mui/icons-material/ScheduleSendOutlined";

type SystemSettings = {
  mercadopago_access_token: string;
  mercadopago_public_key: string;
  trial_days: string;
  pix_expiration_minutes: string;
  recaptcha_version: string;
  recaptcha_v2_site_key: string;
  recaptcha_v2_secret_key: string;
  recaptcha_v3_site_key: string;
  recaptcha_v3_secret_key: string;
};

export default function SettingsPage() {
  const toast = useToast();
  const { me } = useAuth();
  const [tab, setTab] = useState(0);
  const [mpToken, setMpToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [trialDays, setTrialDays] = useState("0");
  const [pixExpiration, setPixExpiration] = useState("30");
  const [recaptchaVersion, setRecaptchaVersion] = useState<string>("off");
  const [recaptchaV2Site, setRecaptchaV2Site] = useState("");
  const [recaptchaV2Secret, setRecaptchaV2Secret] = useState("");
  const [recaptchaV3Site, setRecaptchaV3Site] = useState("");
  const [recaptchaV3Secret, setRecaptchaV3Secret] = useState("");

  useEffect(() => {
    if (me?.role === "SUPERADMIN") {
      api
        .get<SystemSettings>("/settings/system")
        .then((r) => {
          setMpToken(r.data.mercadopago_access_token || "");
          setMpPublicKey(r.data.mercadopago_public_key || "");
          setTrialDays(r.data.trial_days ?? "0");
          setPixExpiration(r.data.pix_expiration_minutes ?? "30");
          setRecaptchaVersion(r.data.recaptcha_version ?? "off");
          setRecaptchaV2Site(r.data.recaptcha_v2_site_key ?? "");
          setRecaptchaV2Secret(r.data.recaptcha_v2_secret_key === "••••••••" ? "" : (r.data.recaptcha_v2_secret_key ?? ""));
          setRecaptchaV3Site(r.data.recaptcha_v3_site_key ?? "");
          setRecaptchaV3Secret(r.data.recaptcha_v3_secret_key === "••••••••" ? "" : (r.data.recaptcha_v3_secret_key ?? ""));
        });
    }
  }, [me?.role]);

  async function handleSaveMp(e: FormEvent) {
    e.preventDefault();
    try {
      const payload: Record<string, string | undefined> = {};
      if (mpPublicKey !== undefined) payload.mercadopago_public_key = mpPublicKey || undefined;
      if (mpToken && mpToken !== "••••••••" && mpToken.length > 10) payload.mercadopago_access_token = mpToken;
      if (pixExpiration !== undefined) payload.pix_expiration_minutes = pixExpiration;
      await api.put("/settings/system", payload);
      toast.push({ type: "success", title: "Mercado Pago", message: "Configurações salvas." });
    } catch (err: any) {
      toast.push({ type: "danger", title: "Mercado Pago", message: err?.response?.data?.message ?? "Erro ao salvar." });
    }
  }

  const isSuperAdmin = me?.role === "SUPERADMIN";
  const hasCompany = !!me?.companyId;

  // SaaS: cada empresa vê só a configuração de delay (acesso limitado)
  if (hasCompany && !isSuperAdmin) {
    return (
      <PageContainer
        title="Configurações"
        subtitle="Configure o delay dos disparos da sua empresa. Cada empresa tem suas próprias configurações."
      >
        <Box sx={{ mt: 2, maxWidth: 640 }}>
          <DisparosSection />
        </Box>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return (
      <PageContainer title="Configurações" subtitle="Configurações da sua empresa.">
        <Paper sx={{ p: 3, textAlign: "center", maxWidth: 400, mx: "auto" }}>
          <Typography color="text.secondary">
            Você precisa estar vinculado a uma empresa para acessar as configurações.
          </Typography>
        </Paper>
      </PageContainer>
    );
  }

  // SuperAdmin: acesso total (aparência, sistema, reCAPTCHA, Mercado Pago, disparos)
  return (
    <PageContainer title="Configurações" subtitle="Personalize dados globais da interface (SuperAdmin).">
      <Box sx={{ mt: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
          <Tab icon={<PaletteOutlined />} iconPosition="start" label="Aparência" />
          <Tab icon={<SmartToyOutlined />} iconPosition="start" label="Sistema" />
          <Tab icon={<SecurityOutlined />} iconPosition="start" label="reCAPTCHA" />
          <Tab icon={<ReceiptOutlined />} iconPosition="start" label="Mercado Pago" />
          <Tab icon={<ScheduleSendOutlined />} iconPosition="start" label="Disparos" />
        </Tabs>

        {tab === 0 && <LogotiposSection />}

          {tab === 2 && (
            <Card variant="outlined" sx={{ maxWidth: 520 }}>
              <CardContent sx={{ "&:last-child": { pb: 3 } }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Google reCAPTCHA
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Proteção em formulários de login e registro. Use v2 (checkbox) ou v3 (invisível). Configure no Google reCAPTCHA Admin.
                </Typography>
                <Box
                  component="form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const payload: Record<string, string> = {
                        recaptcha_version: recaptchaVersion,
                        recaptcha_v2_site_key: recaptchaV2Site,
                        recaptcha_v3_site_key: recaptchaV3Site,
                      };
                      if (recaptchaV2Secret) payload.recaptcha_v2_secret_key = recaptchaV2Secret;
                      if (recaptchaV3Secret) payload.recaptcha_v3_secret_key = recaptchaV3Secret;
                      await api.put("/settings/system", payload);
                      toast.push({ type: "success", title: "reCAPTCHA", message: "Configurações salvas." });
                    } catch (err: any) {
                      toast.push({ type: "danger", title: "reCAPTCHA", message: err?.response?.data?.message ?? "Erro ao salvar." });
                    }
                  }}
                  sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <TextField
                    select
                    fullWidth
                    label="Usar reCAPTCHA em login/registro"
                    value={recaptchaVersion}
                    onChange={(e) => setRecaptchaVersion(e.target.value)}
                    SelectProps={{ native: true }}
                    size="small"
                  >
                    <option value="off">Desativado</option>
                    <option value="v2">reCAPTCHA v2 (checkbox)</option>
                    <option value="v3">reCAPTCHA v3 (invisível)</option>
                  </TextField>
                  <Typography variant="subtitle2" color="text.secondary">reCAPTCHA v2</Typography>
                  <TextField fullWidth size="small" label="Site Key (v2)" value={recaptchaV2Site} onChange={(e) => setRecaptchaV2Site(e.target.value)} placeholder="6Lc..." />
                  <TextField fullWidth size="small" label="Secret Key (v2)" type="password" value={recaptchaV2Secret} onChange={(e) => setRecaptchaV2Secret(e.target.value)} placeholder="Deixe em branco para não alterar" />
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>reCAPTCHA v3</Typography>
                  <TextField fullWidth size="small" label="Site Key (v3)" value={recaptchaV3Site} onChange={(e) => setRecaptchaV3Site(e.target.value)} placeholder="6Lc..." />
                  <TextField fullWidth size="small" label="Secret Key (v3)" type="password" value={recaptchaV3Secret} onChange={(e) => setRecaptchaV3Secret(e.target.value)} placeholder="Deixe em branco para não alterar" />
                  <Button type="submit" variant="contained" color="primary">Salvar reCAPTCHA</Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {tab === 1 && (
            <Card variant="outlined" sx={{ maxWidth: 520 }}>
              <CardContent sx={{ "&:last-child": { pb: 3 } }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Período de teste
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Dias de teste concedidos ao criar conta. Use 0 para desativar.
                </Typography>
                <Box
                  component="form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.put("/settings/system", { trial_days: trialDays });
                      toast.push({ type: "success", title: "Período de teste", message: "Salvo." });
                    } catch (err: any) {
                      toast.push({ type: "danger", title: "Período de teste", message: err?.response?.data?.message ?? "Erro." });
                    }
                  }}
                  sx={{ display: "flex", gap: 2, alignItems: "center" }}
                >
                  <TextField
                    type="number"
                    label="Dias"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    inputProps={{ min: 0, max: 365 }}
                    size="small"
                    sx={{ width: 100 }}
                  />
                  <Button type="submit" variant="contained" color="primary">
                    Salvar
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {tab === 3 && (
            <Card variant="outlined" sx={{ maxWidth: 520 }}>
              <CardContent sx={{ "&:last-child": { pb: 3 } }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Mercado Pago (SaaS)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Token, chave pública e expiração PIX. Webhook: POST /api/webhooks/mercadopago
                </Typography>
                <Box component="form" onSubmit={handleSaveMp}>
                  <TextField
                    fullWidth
                    label="Access Token (privado)"
                    type="password"
                    value={mpToken}
                    onChange={(e) => setMpToken(e.target.value)}
                    placeholder="APP_USR-..."
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Public Key"
                    value={mpPublicKey}
                    onChange={(e) => setMpPublicKey(e.target.value)}
                    placeholder="APP_USR-..."
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Expiração PIX (minutos)"
                    value={pixExpiration}
                    onChange={(e) => setPixExpiration(e.target.value)}
                    helperText="30 a 43200 (30 min a 30 dias). Padrão: 30"
                    inputProps={{ min: 30, max: 43200 }}
                    sx={{ mb: 2 }}
                  />
                  <Button type="submit" variant="contained" color="primary">
                    Salvar
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {tab === 4 && <DisparosSection />}
        </Box>
    </PageContainer>
  );
}

type DispatchSettings = {
  preset: "seguro" | "equilibrado" | "rapido";
  delayMinSec: number;
  delayMaxSec: number;
  batchSize: number;
  pauseBetweenBatchesSec: number;
  estimatedPerHour: number;
  apiTermsAcceptedAt: string | null;
};

const DISPAROS_PRESETS: Array<{
  id: "seguro" | "equilibrado" | "rapido";
  title: string;
  subtitle: string;
  delay: string;
  lote: string;
  perHour: string;
  recommended?: boolean;
  warning?: string;
}> = [
  { id: "seguro", title: "Seguro", subtitle: "Recomendado", delay: "12–25 s", lote: "15 / pausa 120 s", perHour: "~120/h", recommended: true },
  { id: "equilibrado", title: "Equilibrado", subtitle: "", delay: "8–15 s", lote: "20 / pausa 90 s", perHour: "~180/h" },
  { id: "rapido", title: "Rápido", subtitle: "Com aviso", delay: "5–10 s", lote: "25 / pausa 60 s", perHour: "~240/h", warning: "Maior risco de restrição pelo WhatsApp." },
];

function DisparosSection() {
  const toast = useToast();
  const [settings, setSettings] = useState<DispatchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DispatchSettings>("/settings/dispatch")
      .then((r) => setSettings(r.data))
      .catch(() => toast.push({ type: "danger", title: "Disparos", message: "Erro ao carregar configuração." }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function applyPreset(presetId: "seguro" | "equilibrado" | "rapido") {
    setSaving(presetId);
    try {
      const r = await api.put<DispatchSettings>("/settings/dispatch", { preset: presetId });
      setSettings(r.data);
      toast.push({ type: "success", title: "Disparos", message: "Preset aplicado. Os próximos envios usarão essa configuração." });
    } catch (err: any) {
      toast.push({ type: "danger", title: "Disparos", message: err?.response?.data?.message ?? "Erro ao salvar." });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <Card variant="outlined" sx={{ maxWidth: 640 }}>
        <CardContent><Typography color="text.secondary">Carregando...</Typography></CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ maxWidth: 640 }}>
      <CardContent sx={{ "&:last-child": { pb: 3 } }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Delay dos disparos
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Define o intervalo entre mensagens e pausas entre lotes em campanhas e agendamentos. Escolha um preset:
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {DISPAROS_PRESETS.map((p) => (
            <Paper
              key={p.id}
              variant="outlined"
              sx={{
                p: 2,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                borderColor: settings?.preset === p.id ? "primary.main" : undefined,
                borderWidth: settings?.preset === p.id ? 2 : 1,
              }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {p.title}
                  {p.recommended && (
                    <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                      (recomendado)
                    </Typography>
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Delay {p.delay} · Lote {p.lote} · {p.perHour}
                </Typography>
                {p.warning && (
                  <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
                    {p.warning}
                  </Typography>
                )}
              </Box>
              <Button
                variant={settings?.preset === p.id ? "contained" : "outlined"}
                size="small"
                onClick={() => applyPreset(p.id)}
                disabled={saving !== null}
              >
                {saving === p.id ? "Salvando..." : settings?.preset === p.id ? "Ativo" : "Usar este"}
              </Button>
            </Paper>
          ))}
        </Box>
        {settings && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
              Configuração atual: delay {settings.delayMinSec}–{settings.delayMaxSec} s, lote {settings.batchSize}, pausa {settings.pauseBetweenBatchesSec} s.
            </Typography>
            {settings.apiTermsAcceptedAt && (
              <Typography variant="caption" color="primary" sx={{ mt: 1, display: "block" }}>
                Termo de uso de API terceira: você concordou em{" "}
                {new Date(settings.apiTermsAcceptedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LogotiposSection() {
  const toast = useToast();
  const branding = useBranding();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [title, setTitle] = useState(branding.systemTitle);
  const [saving, setSaving] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  useEffect(() => {
    setTitle(branding.systemTitle);
  }, [branding.systemTitle]);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => { URL.revokeObjectURL(url); setLogoPreview(null); };
    }
    setLogoPreview(null);
  }, [logoFile]);

  useEffect(() => {
    if (logoDarkFile) {
      const url = URL.createObjectURL(logoDarkFile);
      setLogoDarkPreview(url);
      return () => { URL.revokeObjectURL(url); setLogoDarkPreview(null); };
    }
    setLogoDarkPreview(null);
  }, [logoDarkFile]);

  useEffect(() => {
    if (iconFile) {
      const url = URL.createObjectURL(iconFile);
      setIconPreview(url);
      return () => { URL.revokeObjectURL(url); setIconPreview(null); };
    }
    setIconPreview(null);
  }, [iconFile]);

  useEffect(() => {
    if (faviconFile) {
      const url = URL.createObjectURL(faviconFile);
      setFaviconPreview(url);
      return () => { URL.revokeObjectURL(url); setFaviconPreview(null); };
    }
    setFaviconPreview(null);
  }, [faviconFile]);

  async function handleLogoUpload(e: FormEvent) {
    e.preventDefault();
    if (!logoFile) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", logoFile);
      await api.post("/settings/branding/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.push({ type: "success", title: "Logo", message: "Atualizado." });
      setLogoFile(null);
      branding.refresh();
    } catch (err: any) {
      toast.push({ type: "danger", title: "Logo", message: err?.response?.data?.message ?? "Erro." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoDarkUpload(e: FormEvent) {
    e.preventDefault();
    if (!logoDarkFile) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", logoDarkFile);
      await api.post("/settings/branding/logo-dark", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.push({ type: "success", title: "Logo dark", message: "Atualizado." });
      setLogoDarkFile(null);
      branding.refresh();
    } catch (err: any) {
      toast.push({ type: "danger", title: "Logo dark", message: err?.response?.data?.message ?? "Erro." });
    } finally {
      setSaving(false);
    }
  }

  async function handleIconUpload(e: FormEvent) {
    e.preventDefault();
    if (!iconFile) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", iconFile);
      await api.post("/settings/branding/icon", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.push({ type: "success", title: "Ícone sidebar", message: "Atualizado." });
      setIconFile(null);
      branding.refresh();
    } catch (err: any) {
      toast.push({ type: "danger", title: "Ícone", message: err?.response?.data?.message ?? "Erro." });
    } finally {
      setSaving(false);
    }
  }

  async function handleFaviconUpload(e: FormEvent) {
    e.preventDefault();
    if (!faviconFile) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", faviconFile);
      await api.post("/settings/branding/favicon", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.push({ type: "success", title: "Favicon", message: "Atualizado." });
      setFaviconFile(null);
      branding.refresh();
    } catch (err: any) {
      toast.push({ type: "danger", title: "Favicon", message: err?.response?.data?.message ?? "Erro." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/settings/branding/title", { system_title: title });
      branding.refresh();
      toast.push({ type: "success", title: "Título", message: "Salvo." });
    } catch (err: any) {
      toast.push({ type: "danger", title: "Título", message: err?.response?.data?.message ?? "Erro." });
    } finally {
      setSaving(false);
    }
  }

  function UploadCard({
    title,
    desc,
    currentUrl,
    previewUrl,
    file,
    onFileChange,
    onSubmit,
    accept,
    previewSize = { maxHeight: 80, maxWidth: 200 },
  }: {
    title: string;
    desc: string;
    currentUrl: string | null;
    previewUrl: string | null;
    file: File | null;
    onFileChange: (f: File | null) => void;
    onSubmit: (e: FormEvent) => void;
    accept: string;
    previewSize?: { maxHeight?: number; maxWidth?: number };
  }) {
    const displayUrl = previewUrl || currentUrl;
    return (
      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {desc}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box
            sx={{
              width: 120,
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 1,
              border: "1px dashed",
              borderColor: "divider",
              bgcolor: "action.hover",
              overflow: "hidden",
            }}
          >
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Preview"
                style={{ maxHeight: previewSize.maxHeight ?? 72, maxWidth: previewSize.maxWidth ?? 112, objectFit: "contain" }}
              />
            ) : (
              <Typography variant="caption" color="text.secondary">
                Sem imagem
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box component="form" onSubmit={onSubmit} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="outlined" component="label" size="small">
                Escolher arquivo
                <input
                  type="file"
                  accept={accept}
                  hidden
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                />
              </Button>
              <Button type="submit" variant="contained" size="small" disabled={!file || saving}>
                {saving ? "Enviando..." : "Enviar"}
              </Button>
              {file && <Typography variant="caption" color="text.secondary">{file.name}</Typography>}
            </Box>
          </Box>
        </Box>
      </Card>
    );
  }

  return (
    <Box>
      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          Título da aba
        </Typography>
        <Box component="form" onSubmit={handleTitleSave} sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Meu Painel"
            size="small"
            sx={{ minWidth: 200, flex: 1 }}
          />
          <Button type="submit" variant="contained" color="primary" disabled={saving}>
            Salvar
          </Button>
        </Box>
      </Card>

      <UploadCard
        title="Logo (modo claro)"
        desc="Exibido no login, registro e sidebar."
        currentUrl={branding.logoUrl}
        previewUrl={logoPreview}
        file={logoFile}
        onFileChange={setLogoFile}
        onSubmit={handleLogoUpload}
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        previewSize={{ maxHeight: 72, maxWidth: 200 }}
      />

      <UploadCard
        title="Logo (modo escuro)"
        desc="Versão clara para fundos escuros. Usado quando o tema está em dark mode."
        currentUrl={branding.logoDarkUrl}
        previewUrl={logoDarkPreview}
        file={logoDarkFile}
        onFileChange={setLogoDarkFile}
        onSubmit={handleLogoDarkUpload}
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        previewSize={{ maxHeight: 72, maxWidth: 200 }}
      />

      <UploadCard
        title="Ícone da sidebar (fechada)"
        desc="Ícone quadrado exibido quando o menu lateral está recolhido. Recomendado: 40x40 ou 48x48 px."
        currentUrl={branding.iconUrl}
        previewUrl={iconPreview}
        file={iconFile}
        onFileChange={setIconFile}
        onSubmit={handleIconUpload}
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        previewSize={{ maxHeight: 48, maxWidth: 48 }}
      />

      <UploadCard
        title="Favicon"
        desc="Ícone exibido na aba do navegador."
        currentUrl={branding.faviconUrl}
        previewUrl={faviconPreview}
        file={faviconFile}
        onFileChange={setFaviconFile}
        onSubmit={handleFaviconUpload}
        accept=".ico,image/png"
        previewSize={{ maxHeight: 32, maxWidth: 32 }}
      />

      <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: "action.hover" }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Prévia rápida
        </Typography>
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>Sidebar aberta</Typography>
            <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 1, border: "1px solid", borderColor: "divider", width: 180 }}>
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="" style={{ maxHeight: 40, maxWidth: 160, objectFit: "contain" }} />
              ) : (
                <Typography variant="body2" color="text.secondary">{branding.systemTitle}</Typography>
              )}
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>Sidebar fechada</Typography>
            <Box sx={{ p: 1, bgcolor: "background.paper", borderRadius: 1, border: "1px solid", borderColor: "divider", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {branding.iconUrl || branding.faviconUrl ? (
                <img
                  src={branding.iconUrl || branding.faviconUrl || ""}
                  alt=""
                  style={{ width: 40, height: 40, objectFit: "contain" }}
                />
              ) : (
                <Typography variant="h6" color="text.secondary">{branding.systemTitle.charAt(0).toUpperCase()}</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

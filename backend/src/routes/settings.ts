import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import { authMiddleware, enrichAuth, superAdminMiddleware, AuthRequest } from "../middleware/auth";
import { getSetting, setSetting } from "../services/systemSettingService";
import { getDispatchSettings, setDispatchSettings, type DispatchPreset, type DispatchSettingsInput } from "../services/dispatchSettingsService";

const router = Router();
const publicDir = path.resolve(process.cwd(), "public");
const logotiposDir = path.join(publicDir, "logotipos");

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(logotiposDir)) fs.mkdirSync(logotiposDir, { recursive: true });
    cb(null, logotiposDir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.(png|jpg|jpeg|svg|webp)$/i)?.[1] ?? "png").toLowerCase();
    cb(null, `logo.${ext}`);
  },
});

const logoDarkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(logotiposDir)) fs.mkdirSync(logotiposDir, { recursive: true });
    cb(null, logotiposDir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.(png|jpg|jpeg|svg|webp)$/i)?.[1] ?? "png").toLowerCase();
    cb(null, `logo-dark.${ext}`);
  },
});

const faviconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(logotiposDir)) fs.mkdirSync(logotiposDir, { recursive: true });
    cb(null, logotiposDir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.(ico|png)$/i)?.[1] ?? "ico").toLowerCase();
    cb(null, `favicon.${ext}`);
  },
});

const iconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(logotiposDir)) fs.mkdirSync(logotiposDir, { recursive: true });
    cb(null, logotiposDir);
  },
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.(png|jpg|jpeg|svg|webp)$/i)?.[1] ?? "png").toLowerCase();
    cb(null, `icon.${ext}`);
  },
});

const LOGO_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: LOGO_MAX_SIZE } });
const uploadLogoDark = multer({ storage: logoDarkStorage, limits: { fileSize: LOGO_MAX_SIZE } });
const uploadFavicon = multer({ storage: faviconStorage, limits: { fileSize: 512 * 1024 } });
const uploadIcon = multer({ storage: iconStorage, limits: { fileSize: 512 * 1024 } });

const LOGO_EXTS = ["logo.svg", "logo.webp", "logo.png", "logo.jpg", "logo.jpeg"];
const LOGO_DARK_EXTS = ["logo-dark.svg", "logo-dark.webp", "logo-dark.png", "logo-dark.jpg", "logo-dark.jpeg"];
const FAVICON_EXTS = ["favicon.ico", "favicon.png"];
const ICON_EXTS = ["icon.svg", "icon.webp", "icon.png", "icon.jpg", "icon.jpeg"];

/** Branding público (sem auth) - logo, favicon, título */
router.get("/branding", async (_req, res) => {
  const systemTitle = (await getSetting("system_title")) || "Painel de disparos WhatsApp";
  const logoFile = LOGO_EXTS.find((f) => fs.existsSync(path.join(logotiposDir, f)));
  const logoDarkFile = LOGO_DARK_EXTS.find((f) => fs.existsSync(path.join(logotiposDir, f)));
  const faviconFile = FAVICON_EXTS.find((f) => fs.existsSync(path.join(logotiposDir, f)));
  const iconFile = ICON_EXTS.find((f) => fs.existsSync(path.join(logotiposDir, f)));
  res.json({
    systemTitle,
    logoUrl: logoFile ? `/public/logotipos/${logoFile}` : null,
    logoDarkUrl: logoDarkFile ? `/public/logotipos/${logoDarkFile}` : null,
    faviconUrl: faviconFile ? `/public/logotipos/${faviconFile}` : null,
    iconUrl: iconFile ? `/public/logotipos/${iconFile}` : null,
  });
});

/** Configuração pública do reCAPTCHA (sem auth) - para login/registro carregarem o script correto */
router.get("/recaptcha-public", async (_req, res) => {
  const version = (await getSetting("recaptcha_version")) || "off";
  const v2Site = await getSetting("recaptcha_v2_site_key");
  const v3Site = await getSetting("recaptcha_v3_site_key");
  const enabled = version === "v2" ? !!v2Site : version === "v3" ? !!v3Site : false;
  const siteKey = version === "v2" ? v2Site : version === "v3" ? v3Site : null;
  res.json({
    enabled: !!enabled,
    version: enabled ? (version as "v2" | "v3") : null,
    siteKey: siteKey || null,
  });
});

router.use(authMiddleware);

/** Delay dos disparos (por empresa) - qualquer usuário autenticado com companyId */
router.get("/dispatch", async (req: AuthRequest, res) => {
  await enrichAuth(req);
  const companyId = req.companyId;
  if (!companyId) return res.status(403).json({ message: "Você precisa estar vinculado a uma empresa." });
  try {
    const settings = await getDispatchSettings(companyId);
    res.json(settings);
  } catch (e: any) {
    res.status(400).json({ message: e?.message ?? "Erro ao carregar configuração de disparos." });
  }
});

router.put("/dispatch", async (req: AuthRequest, res) => {
  await enrichAuth(req);
  const companyId = req.companyId;
  if (!companyId) return res.status(403).json({ message: "Você precisa estar vinculado a uma empresa." });
  try {
    const schema = z.object({
      preset: z.enum(["seguro", "equilibrado", "rapido"]).optional(),
      delayMinSec: z.number().min(1).max(60).optional(),
      delayMaxSec: z.number().min(1).max(120).optional(),
      batchSize: z.number().min(1).max(100).optional(),
      pauseBetweenBatchesSec: z.number().min(0).max(600).optional(),
      acceptApiTerms: z.boolean().optional(),
    });
    const data = schema.parse(req.body) as DispatchSettingsInput & { preset?: DispatchPreset; acceptApiTerms?: boolean };
    const result = await setDispatchSettings(companyId, data);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: e?.message ?? "Erro ao salvar configuração de disparos." });
  }
});

router.use(superAdminMiddleware);

const MP_KEYS = ["mercadopago_access_token", "mercadopago_public_key"] as const;

const RECAPTCHA_KEYS = [
  "recaptcha_version",
  "recaptcha_v2_site_key",
  "recaptcha_v2_secret_key",
  "recaptcha_v3_site_key",
  "recaptcha_v3_secret_key",
] as const;

/** Lista configurações do sistema (valores mascarados) */
router.get("/system", async (_req, res) => {
  const token = await getSetting("mercadopago_access_token");
  const publicKey = await getSetting("mercadopago_public_key");
  const trialDays = await getSetting("trial_days");
  const pixExpiration = await getSetting("pix_expiration_minutes");
  const recaptchaVersion = await getSetting("recaptcha_version");
  const recaptchaV2Site = await getSetting("recaptcha_v2_site_key");
  const recaptchaV2Secret = await getSetting("recaptcha_v2_secret_key");
  const recaptchaV3Site = await getSetting("recaptcha_v3_site_key");
  const recaptchaV3Secret = await getSetting("recaptcha_v3_secret_key");
  res.json({
    mercadopago_access_token: token ? "••••••••" : "",
    mercadopago_public_key: publicKey ?? "",
    trial_days: trialDays ?? "0",
    pix_expiration_minutes: pixExpiration ?? "30",
    recaptcha_version: recaptchaVersion ?? "off",
    recaptcha_v2_site_key: recaptchaV2Site ?? "",
    recaptcha_v2_secret_key: recaptchaV2Secret ? "••••••••" : "",
    recaptcha_v3_site_key: recaptchaV3Site ?? "",
    recaptcha_v3_secret_key: recaptchaV3Secret ? "••••••••" : "",
  });
});

/** Atualiza configurações (SuperAdmin) */
router.put("/system", async (req, res) => {
  try {
    const schema = z.object({
      mercadopago_access_token: z.string().optional(),
      mercadopago_public_key: z.string().optional(),
      system_title: z.string().min(1).max(80).optional(),
      trial_days: z.union([z.string(), z.number()]).optional(),
      pix_expiration_minutes: z.union([z.string(), z.number()]).optional(),
      recaptcha_version: z.enum(["off", "v2", "v3"]).optional(),
      recaptcha_v2_site_key: z.string().optional(),
      recaptcha_v2_secret_key: z.string().optional(),
      recaptcha_v3_site_key: z.string().optional(),
      recaptcha_v3_secret_key: z.string().optional(),
    });
    const data = schema.parse(req.body);
    if (data.mercadopago_access_token !== undefined) {
      await setSetting("mercadopago_access_token", data.mercadopago_access_token);
    }
    if (data.mercadopago_public_key !== undefined) {
      await setSetting("mercadopago_public_key", data.mercadopago_public_key);
    }
    if (data.system_title !== undefined) {
      await setSetting("system_title", data.system_title);
    }
    if (data.trial_days !== undefined) {
      const v = typeof data.trial_days === "number" ? String(data.trial_days) : data.trial_days;
      await setSetting("trial_days", v);
    }
    if (data.pix_expiration_minutes !== undefined) {
      const v = typeof data.pix_expiration_minutes === "number" ? String(data.pix_expiration_minutes) : data.pix_expiration_minutes;
      await setSetting("pix_expiration_minutes", v);
    }
    for (const key of RECAPTCHA_KEYS) {
      const val = data[key];
      if (val !== undefined) await setSetting(key, val);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao salvar" });
  }
});

/** Upload logo (SuperAdmin) */
router.post("/branding/logo", uploadLogo.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
  ["logo.png", "logo.jpg", "logo.jpeg", "logo.svg", "logo.webp"].forEach((f) => {
    const p = path.join(logotiposDir, f);
    if (fs.existsSync(p) && f !== req.file!.filename) fs.unlinkSync(p);
  });
  res.json({ url: `/public/logotipos/${req.file.filename}` });
});

/** Upload logo dark mode (SuperAdmin) */
router.post("/branding/logo-dark", uploadLogoDark.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
  LOGO_DARK_EXTS.forEach((f) => {
    const p = path.join(logotiposDir, f);
    if (fs.existsSync(p) && f !== req.file!.filename) fs.unlinkSync(p);
  });
  res.json({ url: `/public/logotipos/${req.file.filename}` });
});

/** Upload favicon (SuperAdmin) */
router.post("/branding/favicon", uploadFavicon.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
  ["favicon.ico", "favicon.png"].forEach((f) => {
    const p = path.join(logotiposDir, f);
    if (fs.existsSync(p) && f !== req.file!.filename) fs.unlinkSync(p);
  });
  res.json({ url: `/public/logotipos/${req.file.filename}` });
});

/** Upload ícone sidebar fechada (SuperAdmin) */
router.post("/branding/icon", uploadIcon.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
  ICON_EXTS.forEach((f) => {
    const p = path.join(logotiposDir, f);
    if (fs.existsSync(p) && f !== req.file!.filename) fs.unlinkSync(p);
  });
  res.json({ url: `/public/logotipos/${req.file.filename}` });
});

/** Atualiza título do sistema (SuperAdmin) */
router.put("/branding/title", async (req, res) => {
  try {
    const schema = z.object({ system_title: z.string().min(1).max(80) });
    const { system_title } = schema.parse(req.body);
    await setSetting("system_title", system_title);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao salvar" });
  }
});

export default router;

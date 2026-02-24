import { Router } from "express";
import { z } from "zod";
import { bootstrapAdmin, loginUser, registerUser } from "../services/authService";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";
import bcrypt from "bcryptjs";
import { authRateLimiter, registerRateLimiter } from "../security";
import { securityLogger } from "../security/securityLogger";
import { getSetting } from "../services/systemSettingService";
import { verifyRecaptcha } from "../services/recaptchaService";

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  recaptchaToken: z.string().optional(),
});

async function ensureRecaptcha(req: { body?: { recaptchaToken?: string } }, action: "login" | "register"): Promise<{ ok: true } | { ok: false; message: string }> {
  const version = (await getSetting("recaptcha_version")) || "off";
  if (version !== "v2" && version !== "v3") return { ok: true };

  const token = req.body?.recaptchaToken;
  if (!token || typeof token !== "string") {
    return { ok: false, message: "Verificação de segurança (reCAPTCHA) é obrigatória." };
  }

  const secret = version === "v2"
    ? await getSetting("recaptcha_v2_secret_key")
    : await getSetting("recaptcha_v3_secret_key");
  if (!secret) return { ok: true };

  const result = await verifyRecaptcha(token, secret, {
    expectedAction: action,
    minScore: version === "v3" ? 0.5 : undefined,
  });
  if (!result.ok) return { ok: false, message: result.error || "Verificação de segurança falhou." };
  return { ok: true };
}

router.post("/register", registerRateLimiter, async (req, res) => {
  try {
    const recaptchaCheck = await ensureRecaptcha(req, "register");
    if (!recaptchaCheck.ok) return res.status(400).json({ message: recaptchaCheck.message });

    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
      companyName: z.string().min(2, "Nome da empresa é obrigatório"),
      planId: z.string().min(1, "Selecione um plano"),
    });
    const data = schema.parse(req.body);
    const user = await registerUser(data);
    return res.status(201).json({
      id: user.id,
      email: user.email,
      company: user.company ? { id: user.company.id, name: user.company.name } : null,
    });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || "Erro ao registrar" });
  }
});

router.post("/login", authRateLimiter, async (req, res) => {
  try {
    const recaptchaCheck = await ensureRecaptcha(req, "login");
    if (!recaptchaCheck.ok) return res.status(400).json({ message: recaptchaCheck.message });

    const { email, password } = authSchema.parse(req.body);
    const { user, token } = await loginUser(email, password);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        company: user.company,
      },
    });
  } catch (err: any) {
    const email = (req.body?.email as string) ?? "?";
    securityLogger.logAuthFailure(req.ip ?? "unknown", email);
    return res.status(401).json({ message: err.message || "Erro ao autenticar" });
  }
});

router.post("/bootstrap-admin", registerRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email(),
      password: z.string().min(6),
    });
    const { email, password, name } = schema.parse(req.body);
    const user = await bootstrapAdmin(email, password, name);
    return res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || "Erro no bootstrap" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      company: {
        include: { subscription: { include: { plan: true } } },
      },
    },
  });
  if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
  if (user.companyId && user.company?.isActive === false) {
    return res.status(403).json({ message: "Empresa desativada. Entre em contato com o suporte." });
  }
  const sub = user.company?.subscription;
  const trialEndsAt = sub?.trialEndsAt ?? null;
  const now = new Date();
  const isTrialExpired = trialEndsAt != null && now > trialEndsAt;
  const hasActivePaidAccess =
    sub && sub.currentPeriodEnd > now && (trialEndsAt == null || !isTrialExpired);
  const menuPermissions = user.menuPermissions as string[] | null;
  return res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    companyId: user.companyId,
    menuPermissions: Array.isArray(menuPermissions) ? menuPermissions : null,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
        }
      : null,
    subscription: sub
      ? {
          trialEndsAt: trialEndsAt?.toISOString() ?? null,
          isTrialExpired,
          hasActivePaidAccess: !!hasActivePaidAccess,
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          billingDay: sub.billingDay,
        }
      : null,
  });
});

router.put("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
    });
    const data = schema.parse(req.body);

    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) return res.status(404).json({ message: "Usuário não encontrado" });

    if (data.email && data.email !== current.email) {
      const exists = await prisma.user.findUnique({ where: { email: data.email } });
      if (exists) return res.status(400).json({ message: "E-mail já cadastrado" });
    }

    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.email !== undefined) update.email = data.email;
    if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.update({
      where: { id: userId },
      data: update,
      include: { company: true },
    });

    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      companyId: user.companyId,
      company: user.company
        ? { id: user.company.id, name: user.company.name, slug: user.company.slug }
        : null,
    });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || "Erro ao atualizar perfil" });
  }
});

export default router;

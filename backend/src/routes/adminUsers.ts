import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { prisma } from "../prismaClient";
import { MENU_KEYS, MENU_KEYS_LIST } from "../constants/menuPermissions";

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/menu-keys", (_req, res) => {
  res.json({ menuKeys: MENU_KEYS });
});

router.get("/users", async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { role: true, companyId: true },
  });
  const companyIdParam = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
  let where: { companyId?: string } =
    me?.role === "SUPERADMIN"
      ? companyIdParam
        ? { companyId: companyIdParam }
        : {}
      : { companyId: me?.companyId ?? "none" };
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, companyId: true, menuPermissions: true, createdAt: true },
  });
  res.json(users);
});

router.post("/users", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["ADMIN", "SUPERVISOR", "USER"]).default("USER"),
      companyId: z.string().nullable().optional(),
      menuPermissions: z.array(z.string()).optional(),
    });
    const { email, password, role, name, companyId, menuPermissions } = schema.parse(req.body);

    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { role: true, companyId: true },
    });
    const targetCompanyId =
      me?.role === "SUPERADMIN" ? companyId ?? me?.companyId : me?.companyId;
    if (me?.role !== "SUPERADMIN" && !targetCompanyId) {
      return res.status(400).json({ message: "Usuário precisa estar em uma empresa" });
    }
    if (me?.role === "ADMIN" && role === "ADMIN") {
      return res.status(400).json({ message: "Apenas SuperAdmin pode criar outros administradores." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "E-mail já cadastrado" });

    if (targetCompanyId) {
      const { assertWithinLimit } = await import("../services/planLimitsService");
      await assertWithinLimit(targetCompanyId, "users");
    }

    const validMenuPerms = menuPermissions?.filter((k) => MENU_KEYS_LIST.includes(k as any));
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        name,
        companyId: targetCompanyId ?? undefined,
        menuPermissions: validMenuPerms?.length ? validMenuPerms : undefined,
      },
      select: { id: true, email: true, name: true, role: true, companyId: true, menuPermissions: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao criar usuário" });
  }
});

router.put("/users/:id", async (req: AuthRequest, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { role: true, companyId: true },
    });
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { companyId: true, role: true },
    });
    if (!target) return res.status(404).json({ message: "Usuário não encontrado" });
    if (me?.role === "ADMIN" && target.companyId !== me?.companyId) {
      return res.status(403).json({ message: "Sem permissão para editar este usuário." });
    }

    const schema = z.object({
      name: z.string().min(2).nullable().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      role: z.enum(["ADMIN", "SUPERVISOR", "USER"]).optional(),
      menuPermissions: z.array(z.string()).nullable().optional(),
    });
    const data = schema.parse(req.body);

    if (me?.role === "ADMIN" && data.role === "ADMIN") {
      return res.status(400).json({ message: "Apenas SuperAdmin pode promover a administrador." });
    }

    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.email !== undefined) update.email = data.email;
    if (data.role !== undefined) update.role = data.role;
    if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);
    if (data.menuPermissions !== undefined) {
      update.menuPermissions =
        data.menuPermissions === null || !data.menuPermissions?.length
          ? null
          : data.menuPermissions.filter((k) => MENU_KEYS_LIST.includes(k as any));
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: update,
      select: { id: true, email: true, name: true, role: true, companyId: true, menuPermissions: true, createdAt: true },
    });
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao atualizar usuário" });
  }
});

router.delete("/users/:id", async (req: AuthRequest, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { role: true, companyId: true },
    });
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { companyId: true },
    });
    if (!target) return res.status(404).json({ message: "Usuário não encontrado" });
    if (me?.role === "ADMIN" && target.companyId !== me?.companyId) {
      return res.status(403).json({ message: "Sem permissão para remover este usuário." });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao remover usuário" });
  }
});

export default router;


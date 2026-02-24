import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { authMiddleware, enrichAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";
import {
  fetchGroupsFromRemote,
  listGroupsFull,
} from "../services/whatsappService";
import { checkLimit } from "../services/planLimitsService";
import { logger } from "../utils/logger";

const router = Router();
router.use(authMiddleware);
router.use(async (req, _res, next) => {
  await enrichAuth(req as AuthRequest);
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(csv|xlsx?)$/i.test(file.originalname);
    cb(null, !!ok);
  },
});

/** Lista todos os grupos com dados completos */
router.get("/", async (req: AuthRequest, res) => {
  try {
    const companyId = requireCompany(req);
    const groups = await listGroupsFull(companyId);
    res.json(groups);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao listar grupos" });
  }
});

/** Sincroniza grupos do WhatsApp e atualiza fotos/participantes */
router.post("/sync", async (req: AuthRequest, res) => {
  try {
    const companyId = requireCompany(req);
    await fetchGroupsFromRemote(companyId);
    const groups = await listGroupsFull(companyId);
    res.json(groups);
  } catch (err: any) {
    const message = err?.message ?? "Erro ao sincronizar";
    logger.warn("GROUPS", `POST /sync 400: ${message}`);
    res.status(400).json({ message });
  }
});

/** Exporta grupos em CSV */
router.get("/export", async (req: AuthRequest, res) => {
  try {
    const companyId = requireCompany(req);
    const groups = await listGroupsFull(companyId);
    const header = "waId;nome;participantes;fonte\n";
    const rows = groups
      .map(
        (g) =>
          `${escapeCsv(g.waId)};${escapeCsv(g.name)};${g.participantCount ?? ""};${g.source}`
      )
      .join("\n");
    const csv = "\uFEFF" + header + rows; // BOM para Excel
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=grupos.csv");
    res.send(csv);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao exportar" });
  }
});

function escapeCsv(s: string): string {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function requireCompany(req: AuthRequest): string {
  const companyId = req.companyId;
  if (!companyId) throw new Error("Usuário precisa estar vinculado a uma empresa.");
  return companyId;
}

/** Importa grupos de CSV ou Excel */
router.post("/import", upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const companyId = requireCompany(req);
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    const session = await prisma.whatsappSession.findFirst({
      where: { companyId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (!session) {
      return res.status(400).json({
        message: "Crie uma conexão WhatsApp antes de importar grupos",
      });
    }

    const rows = parseFile(file.buffer, file.originalname);
    if (rows.length === 0) {
      return res.status(400).json({
        message: "Arquivo vazio ou sem dados válidos",
      });
    }

    let created = 0;
    for (const row of rows) {
      const waId = normalizeWaId(row.waId);
      const name = (row.name || row.nome || waId).trim();
      if (!waId || !name) continue;

      try {
        const existing = await prisma.whatsappGroup.findUnique({
          where: { sessionId_waId: { sessionId: session.id, waId } },
        });
        if (!existing) {
          const { allowed } = await checkLimit(companyId, "groups");
          if (!allowed) continue;
        }
        await prisma.whatsappGroup.upsert({
          where: {
            sessionId_waId: { sessionId: session.id, waId },
          },
          create: {
            waId,
            name,
            sessionId: session.id,
            source: "imported",
          },
          update: {
            name,
            source: "imported",
          },
        });
        created++;
      } catch (_) {
        // ignorar duplicatas
      }
    }

    const groups = await listGroupsFull(companyId);
    res.json({ created, total: groups.length, groups });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao importar" });
  }
});

function normalizeWaId(value: string): string {
  if (!value || typeof value !== "string") return "";
  let s = value.trim();
  if (s.startsWith("https://chat.whatsapp.com/")) {
    // link de convite - não conseguimos resolver para waId sem API adicional
    return "";
  }
  if (!s.includes("@")) {
    s = s.replace(/\D/g, "") + "@g.us";
  }
  return s;
}

type ParsedRow = { waId: string; name?: string; nome?: string };

function parseFile(buffer: Buffer, filename: string): ParsedRow[] {
  const ext = (filename || "").toLowerCase();
  if (ext.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }
  if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
    return parseExcel(buffer);
  }
  return [];
}

function parseCsv(content: string): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].toLowerCase().split(sep).map((h) => h.trim());
  const waIdx = headers.findIndex((h) => /waid|wa_id|id|grupo/.test(h));
  const nameIdx = headers.findIndex((h) => /nome|name|nome do grupo/.test(h));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], sep);
    const waId = waIdx >= 0 ? cells[waIdx]?.trim() : cells[0]?.trim();
    const name = nameIdx >= 0 ? cells[nameIdx]?.trim() : cells[1]?.trim();
    if (waId) rows.push({ waId, name });
  }
  return rows;
}

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === sep) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseExcel(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const first = Object.keys(wb.Sheets)[0];
  if (!first) return [];
  const sheet = wb.Sheets[first];
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown as string[][];

  if (!data.length) return [];

  const headers = (data[0] || []).map((h) => String(h || "").toLowerCase());
  const waIdx = headers.findIndex((h) => /waid|wa_id|id|grupo/.test(h));
  const nameIdx = headers.findIndex((h) => /nome|name/.test(h));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    const waId = String(waIdx >= 0 ? row[waIdx] : row[0] ?? "").trim();
    const name = String(nameIdx >= 0 ? row[nameIdx] : row[1] ?? "").trim();
    if (waId) rows.push({ waId, name });
  }
  return rows;
}

export default router;

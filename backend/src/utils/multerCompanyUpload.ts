import path from "path";
import fs from "fs";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";

/** Pasta base de uploads - toda mídia vai para uploads/{companyId}/ */
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

/**
 * Cria multer configurado para salvar na pasta da empresa.
 * Se a pasta não existir, cria automaticamente (como no Whaticket).
 * Usuários sem companyId usam pasta "_default".
 */
function getCompanyUploadDir(req: AuthRequest): string {
  const companyId = req.companyId || "_default";
  const dir = path.join(UPLOADS_DIR, companyId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Multer para imagens de produtos (vários arquivos).
 */
export const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, getCompanyUploadDir(req as AuthRequest));
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `product_${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** Tipos MIME permitidos para campanhas: imagens, vídeos, áudios, documentos */
const CAMPAIGN_ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
  "video/mp4", "video/3gpp", "video/quicktime", "video/x-msvideo", "video/webm",
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/ogg", "audio/webm", "audio/x-m4a", "audio/amr", "audio/aac", "audio/opus",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
];

/** Extensões permitidas quando o MIME vem incorreto (ex.: application/octet-stream no Windows). */
const CAMPAIGN_ALLOWED_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp",
  "mp4", "webm", "mov", "3gp", "avi",
  "mp3", "ogg", "opus", "m4a", "aac", "amr", "webm",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
]);

function isCampaignMediaAllowed(mime: string, originalname: string): boolean {
  const m = (mime || "").toLowerCase().trim();
  const ext = path.extname(originalname || "").replace(/^\./, "").toLowerCase();
  if (ext && CAMPAIGN_ALLOWED_EXT.has(ext)) return true;
  if (!m || m === "application/octet-stream") return false;
  if (CAMPAIGN_ALLOWED_MIMES.includes(m)) return true;
  if (m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/")) return true;
  return false;
}

/**
 * Multer para mídia de campanhas: imagens, vídeos, áudios (ogg), documentos (arquivo único).
 * Limite 16MB (WhatsApp).
 */
export const campaignImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, getCompanyUploadDir(req as AuthRequest));
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = isCampaignMediaAllowed(file.mimetype || "", file.originalname || "");
    if (ok) return cb(null, true);
    cb(new Error(`Tipo não permitido: ${file.mimetype || "desconhecido"}. Use imagens, vídeos, áudios ou documentos.`));
  },
});

/**
 * Retorna o filePath a ser salvo no banco (uploads/{companyId}/filename).
 */
export function getFilePathForDb(req: AuthRequest, filename: string): string {
  const companyId = req.companyId || "_default";
  return `uploads/${companyId}/${filename}`;
}

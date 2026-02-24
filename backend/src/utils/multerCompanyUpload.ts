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

/** Tipos MIME permitidos para campanhas: imagens, vídeos, áudios (incl. ogg), documentos */
const CAMPAIGN_ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
  "video/mp4", "video/3gpp", "video/quicktime", "video/x-msvideo", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/x-m4a", "audio/amr", "audio/aac",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
];

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
    const mime = (file.mimetype || "").toLowerCase();
    const allowed =
      CAMPAIGN_ALLOWED_MIMES.includes(mime) ||
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime.startsWith("audio/");
    if (allowed) return cb(null, true);
    cb(new Error(`Tipo não permitido: ${file.mimetype}. Use imagens, vídeos, áudios ou documentos.`));
  },
});

/**
 * Retorna o filePath a ser salvo no banco (uploads/{companyId}/filename).
 */
export function getFilePathForDb(req: AuthRequest, filename: string): string {
  const companyId = req.companyId || "_default";
  return `uploads/${companyId}/${filename}`;
}

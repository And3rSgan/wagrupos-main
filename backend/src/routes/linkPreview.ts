import { Router, Response } from "express";
import axios from "axios";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const URL_REGEX = /^(https?):\/\/[^\s/$.?#].[^\s]*$/i;

function getMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
  const m1 = html.match(re1);
  if (m1) return m1[1];
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i");
  const m2 = html.match(re2);
  if (m2) return m2[1];
  const re3 = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
  const m3 = html.match(re3);
  return m3 ? m3[1] : null;
}

function extractMeta(html: string, baseUrl: string): { title?: string; description?: string; image?: string } {
  const title = getMeta(html, "og:title") ?? getMeta(html, "twitter:title");
  const description = getMeta(html, "og:description") ?? getMeta(html, "twitter:description");
  let image = getMeta(html, "og:image") ?? getMeta(html, "twitter:image");
  if (image && image.startsWith("/")) {
    try {
      const u = new URL(baseUrl);
      image = `${u.protocol}//${u.host}${image}`;
    } catch {}
  }
  return { title: title ?? undefined, description: description ?? undefined, image: image ?? undefined };
}

/** GET /link-preview?url=... - retorna og:title, og:description, og:image */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url || !URL_REGEX.test(url)) {
      return res.status(400).json({ message: "URL inválida" });
    }
    const response = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 3,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)" },
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const html = response.data || "";
    const meta = extractMeta(html, url);
    res.json(meta);
  } catch (err: any) {
    if (err?.response?.status === 403 || err?.response?.status === 401) {
      return res.status(400).json({ message: "Não foi possível acessar o link" });
    }
    if (err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" || err?.code === "ETIMEDOUT") {
      return res.status(400).json({ message: "Link inacessível" });
    }
    return res.status(400).json({ message: err?.message || "Erro ao buscar preview" });
  }
});

export default router;

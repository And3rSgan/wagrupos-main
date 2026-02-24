import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { api } from "../api";

interface WhatsAppPreviewProps {
  message: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) || [];
  return [...new Set(matches)];
}

function formatWhatsAppText(text: string): React.ReactNode {
  const re = new RegExp("(\\*[^*]+\\*|_[^_]+_|~[^~]+~)", "g");
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const raw = match[1];
    if (raw.startsWith("*")) {
      result.push(<strong key={key++}>{raw.slice(1, -1)}</strong>);
    } else if (raw.startsWith("_")) {
      result.push(<em key={key++}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith("~")) {
      result.push(
        <span key={key++} style={{ textDecoration: "line-through" }}>
          {raw.slice(1, -1)}
        </span>
      );
    } else {
      result.push(raw);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result.length > 0 ? result : text;
}

type LinkPreview = { title?: string; description?: string; image?: string };

export function WhatsAppPreview({ message }: WhatsAppPreviewProps) {
  const hasContent = message.trim().length > 0;
  const urls = extractUrls(message);
  const firstUrl = urls[0];
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!firstUrl) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    api
      .get<LinkPreview>("/link-preview", { params: { url: firstUrl } })
      .then((res) => {
        if (!cancelled && res.data && (res.data.title || res.data.description || res.data.image)) {
          setPreview(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [firstUrl]);

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", py: 1 }}>
      <Box
        sx={{
          maxWidth: "85%",
          bgcolor: "#DCF8C6",
          borderRadius: 2,
          overflow: "hidden",
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
        }}
      >
        {preview && (preview.image || preview.title || preview.description) && (
          <Box
            sx={{
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              bgcolor: "rgba(255,255,255,0.5)",
            }}
          >
            {preview.image && (
              <Box
                component="img"
                src={preview.image}
                alt=""
                sx={{
                  width: "100%",
                  maxHeight: 200,
                  objectFit: "cover",
                  display: "block",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <Box sx={{ px: 1.5, py: 1 }}>
              {preview.title && (
                <Box sx={{ fontWeight: 600, fontSize: 13, color: "#000", mb: 0.5 }}>{preview.title}</Box>
              )}
              {preview.description && (
                <Box sx={{ fontSize: 12, color: "#54656f", lineHeight: 1.3, mb: 0.5 }}>
                  {preview.description.length > 120 ? preview.description.slice(0, 120) + "…" : preview.description}
                </Box>
              )}
              {firstUrl && (
                <Box sx={{ fontSize: 11, color: "#8696a0" }}>{getDomain(firstUrl)}</Box>
              )}
            </Box>
          </Box>
        )}
        {loading && firstUrl && (
          <Box sx={{ px: 1.5, py: 1, fontSize: 11, color: "#8696a0", fontStyle: "italic" }}>
            Carregando preview…
          </Box>
        )}
        <Box sx={{ px: 1.5, py: 1 }}>
          <Box sx={{ fontFamily: "system-ui,sans-serif", fontSize: 13, lineHeight: 1.45, color: "#000", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {hasContent ? formatWhatsAppText(message) : "Sua mensagem aparecerá aqui"}
          </Box>
          <Box sx={{ fontSize: 10, color: "#667781", textAlign: "right", mt: 0.5 }}>
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

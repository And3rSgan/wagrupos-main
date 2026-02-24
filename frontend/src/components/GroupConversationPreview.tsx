import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { api } from "../api";

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

export type MediaFile = {
  file: File;
  type: "image" | "video" | "audio" | "document";
  preview?: string;
};

export interface GroupConversationPreviewProps {
  message: string;
  mediaFile?: MediaFile | null;
  mediaUrl?: string | null;
  groupName?: string;
  participantCount?: number;
}

export function GroupConversationPreview({
  message,
  mediaFile,
  mediaUrl,
  groupName = "Grupo do WhatsApp",
  participantCount,
}: GroupConversationPreviewProps) {
  const urls = extractUrls(message);
  const firstUrl = urls[0];
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!firstUrl) {
      setLinkPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLinkPreview(null);
    api
      .get<LinkPreview>("/link-preview", { params: { url: firstUrl } })
      .then((res) => {
        if (!cancelled && res.data && (res.data.title || res.data.description || res.data.image)) {
          setLinkPreview(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firstUrl]);

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  const hasMedia = !!(mediaFile || mediaUrl);
  const mediaType = mediaFile?.type;

  return (
    <Box
      sx={{
        bgcolor: "#efeae2",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        maxWidth: 360,
        mx: "auto",
      }}
    >
      {/* Header do grupo */}
      <Box
        sx={{
          bgcolor: "#f0f2f5",
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: "#25D366",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          #
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} noWrap>
            {groupName}
          </Typography>
          {participantCount != null && (
            <Typography variant="caption" color="text.secondary">
              {participantCount} participantes
            </Typography>
          )}
        </Box>
      </Box>

      {/* Área da conversa */}
      <Box sx={{ p: 2, minHeight: 120, display: "flex", justifyContent: "flex-end" }}>
        <Box
          sx={{
            maxWidth: "85%",
            bgcolor: "#DCF8C6",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 1px 0.5px rgba(0,0,0,0.08)",
          }}
        >
          {hasMedia && (
            <Box sx={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              {mediaType === "image" && (mediaFile?.preview || mediaUrl) && (
                <Box
                  component="img"
                  src={mediaFile?.preview || mediaUrl || ""}
                  alt=""
                  sx={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {mediaType === "video" && (mediaFile?.preview || mediaUrl) && (
                <Box
                  component="video"
                  src={mediaFile?.preview || mediaUrl || ""}
                  controls={false}
                  muted
                  sx={{ width: "100%", maxHeight: 180, display: "block", bgcolor: "#000" }}
                  onError={(e) => {
                    (e.target as HTMLVideoElement).style.display = "none";
                  }}
                />
              )}
              {mediaType === "audio" && (
                <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                    }}
                  >
                    ♪
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {mediaFile?.file?.name || "Áudio"}
                  </Typography>
                </Box>
              )}
              {mediaType === "document" && (
                <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 48,
                      borderRadius: 1,
                      bgcolor: "grey.400",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 20,
                    }}
                  >
                    📄
                  </Box>
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                    {mediaFile?.file?.name || "Documento"}
                  </Typography>
                </Box>
              )}
              {mediaUrl && !mediaFile && !mediaType && (
                <Box
                  component="img"
                  src={mediaUrl}
                  alt=""
                  sx={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </Box>
          )}
          {linkPreview && (linkPreview.image || linkPreview.title || linkPreview.description) && (
            <Box sx={{ borderBottom: "1px solid rgba(0,0,0,0.08)", bgcolor: "rgba(255,255,255,0.5)" }}>
              {linkPreview.image && (
                <Box
                  component="img"
                  src={linkPreview.image}
                  alt=""
                  sx={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <Box sx={{ px: 1.5, py: 1 }}>
                {linkPreview.title && (
                  <Box sx={{ fontWeight: 600, fontSize: 13, color: "#000", mb: 0.5 }}>{linkPreview.title}</Box>
                )}
                {linkPreview.description && (
                  <Box sx={{ fontSize: 12, color: "#54656f", lineHeight: 1.3, mb: 0.5 }}>
                    {linkPreview.description.length > 120 ? linkPreview.description.slice(0, 120) + "…" : linkPreview.description}
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
            <Box
              sx={{
                fontFamily: "system-ui,sans-serif",
                fontSize: 13,
                lineHeight: 1.45,
                color: "#000",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {message.trim() ? formatWhatsAppText(message) : "Sua mensagem aparecerá aqui"}
            </Box>
            <Box sx={{ fontSize: 10, color: "#667781", textAlign: "right", mt: 0.5 }}>
              {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

import { FormEvent, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { useToast } from "../toast/ToastContext";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { MessageGenerator } from "../components/MessageGenerator";
import { GroupConversationPreview, type MediaFile } from "../components/GroupConversationPreview";
import { type GroupWithAvatar } from "../components/GroupCard";
import Avatar from "@mui/material/Avatar";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ImageIcon from "@mui/icons-material/Image";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { ApiTermsDialog } from "../components/ApiTermsDialog";

const ACCEPT_MEDIA =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/ogg,audio/opus";

function getMediaType(file: File): "image" | "video" | "audio" | "document" {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "document";
}

type Group = { id: string; name: string };
type Campaign = {
  id: string;
  title?: string | null;
  messageText: string;
  linkUrl?: string | null;
  imagePath?: string | null;
  status: string;
  errorMessage?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  targets?: { id: string; group: Group }[];
};

export default function CampaignsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupWithAvatar[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [sendNow, setSendNow] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [repeatRule, setRepeatRule] = useState<"none" | "daily" | "weekly">("none");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [templateIdForCampaign, setTemplateIdForCampaign] = useState("");
  const [mentionAll, setMentionAll] = useState(false);
  const [limits, setLimits] = useState<{
    campaignsPerDay: { usedToday: number; limit: number };
    groupsPerCampaign: number;
  } | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [dispatchSettings, setDispatchSettings] = useState<{ apiTermsAcceptedAt: string | null } | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const pendingCreateRef = useRef<(() => Promise<void>) | null>(null);

  const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));
  const groupSearchLower = groupSearch.trim().toLowerCase();
  const filteredGroups = groupSearchLower
    ? groups.filter((g) => g.name.toLowerCase().includes(groupSearchLower))
    : groups;
  const maxGroups = limits?.groupsPerCampaign ?? 999;
  const canSelectMoreGroups = selectedGroupIds.length < maxGroups;
  const campaignsToday = limits?.campaignsPerDay ?? { usedToday: 0, limit: 50 };
  const atDailyLimit = campaignsToday.usedToday >= campaignsToday.limit;
  const previewGroup = selectedGroups[0];
  const previewGroupName = previewGroup?.name ?? "Grupo do WhatsApp";

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMediaFile(null);
      return;
    }
    const type = getMediaType(file);
    const preview = type === "image" || type === "video" ? URL.createObjectURL(file) : undefined;
    setMediaFile({ file, type, preview });
  }, []);

  useEffect(() => {
    return () => {
      if (mediaFile?.preview) URL.revokeObjectURL(mediaFile.preview);
    };
  }, [mediaFile?.preview]);

  async function loadGroups() {
    const res = await api.get<GroupWithAvatar[]>("/groups");
    setGroups(res.data);
  }

  async function loadCampaigns() {
    const res = await api.get<Campaign[]>("/campaigns");
    setCampaigns(res.data);
  }

  async function loadLimits() {
    try {
      const res = await api.get<{ campaignsPerDay: { usedToday: number; limit: number }; groupsPerCampaign: number }>("/campaigns/limits");
      setLimits(res.data);
    } catch {
      setLimits(null);
    }
  }

  async function loadDispatchSettings() {
    try {
      const res = await api.get<{ apiTermsAcceptedAt: string | null }>("/settings/dispatch");
      setDispatchSettings(res.data);
    } catch {
      setDispatchSettings(null);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadGroups(), loadCampaigns(), loadLimits(), loadDispatchSettings()]);
    } catch (e: any) {
      toast.push({
        type: "danger",
        title: "Campanhas",
        message: e?.response?.data?.message ?? "Erro ao carregar dados.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxGroups) return prev;
      return [...prev, id];
    });
  }

  async function doCreateCampaign() {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("messageText", messageText);
    if (linkUrl) fd.append("linkUrl", linkUrl);
    fd.append("groupIds", selectedGroupIds.join(","));
    if (sendNow) fd.append("sendNow", "true");
    if (mentionAll) fd.append("mentionAll", "true");
    if (selectedProductId) fd.append("productId", selectedProductId);
    if (templateIdForCampaign) fd.append("templateId", templateIdForCampaign);
    if (scheduleEnabled && scheduleDate && scheduleTime) {
      const dt = new Date(`${scheduleDate}T${scheduleTime}`);
      if (dt > new Date()) fd.append("scheduledAt", dt.toISOString());
      fd.append("repeatRule", repeatRule);
    }
    if (mediaFile) fd.append("image", mediaFile.file);

    const res = await api.post<Campaign>("/campaigns", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    setCampaigns((prev) => [res.data, ...prev]);
    setTitle("");
    setMessageText("");
    setLinkUrl("");
    setSelectedGroupIds([]);
    setMediaFile(null);
    setSendNow(false);
    setMentionAll(false);
    setScheduleEnabled(false);
    setScheduleDate("");
    setScheduleTime("");
    setRepeatRule("none");

    toast.push({
      type: "success",
      title: "Campanhas",
      message: scheduleEnabled ? "Campanha agendada." : "Campanha criada.",
    });
    if (sendNow) await loadLimits();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedGroupIds.length) {
      toast.push({ type: "warning", title: "Campanhas", message: "Selecione ao menos 1 grupo." });
      return;
    }
    if (!messageText.trim()) {
      toast.push({ type: "warning", title: "Campanhas", message: "Informe o texto da campanha." });
      return;
    }
    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast.push({ type: "warning", title: "Campanhas", message: "Informe data e horário para agendar." });
      return;
    }
    if (atDailyLimit && (sendNow || scheduleEnabled)) {
      toast.push({
        type: "warning",
        title: "Limite diário",
        message: `Limite diário de envios para grupos atingido (${campaignsToday.usedToday}/${campaignsToday.limit}). Não é possível enviar nem agendar. Tente novamente amanhã.`,
      });
      return;
    }

    if (!dispatchSettings?.apiTermsAcceptedAt) {
      pendingCreateRef.current = async () => {
        setLoading(true);
        try {
          await doCreateCampaign();
        } catch (e: any) {
          toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao criar campanha." });
        } finally {
          setLoading(false);
        }
      };
      setShowTermsDialog(true);
      return;
    }

    setLoading(true);
    try {
      await doCreateCampaign();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao criar campanha." });
    } finally {
      setLoading(false);
    }
  }

  async function doSendCampaign(c: Campaign) {
    await api.post(`/campaigns/${c.id}/send`);
    toast.push({ type: "success", title: "Campanhas", message: "Campanha enviada." });
    await Promise.all([loadCampaigns(), loadLimits()]);
  }

  async function sendCampaign(c: Campaign) {
    if (campaignsToday.usedToday >= campaignsToday.limit) {
      toast.push({
        type: "warning",
        title: "Limite diário",
        message: `Limite diário de envios para grupos atingido. Tente novamente amanhã.`,
      });
      return;
    }
    if (!dispatchSettings?.apiTermsAcceptedAt) {
      pendingCreateRef.current = async () => {
        setLoading(true);
        try {
          await doSendCampaign(c);
        } catch (e: any) {
          toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao enviar." });
        } finally {
          setLoading(false);
        }
      };
      setShowTermsDialog(true);
      return;
    }
    setLoading(true);
    try {
      await doSendCampaign(c);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao enviar." });
    } finally {
      setLoading(false);
    }
  }

  async function deleteCampaign(c: Campaign) {
    if (!confirm(`Excluir a campanha "${c.title || "Sem título"}"?`)) return;
    setDeletingId(c.id);
    try {
      await api.delete(`/campaigns/${c.id}`);
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      toast.push({ type: "success", title: "Campanhas", message: "Campanha excluída." });
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao excluir." });
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAllCampaigns() {
    if (!confirm(`Excluir todas as ${campaigns.length} campanhas? Esta ação não pode ser desfeita.`)) return;
    setClearing(true);
    try {
      await api.delete("/campaigns/all");
      setCampaigns([]);
      toast.push({ type: "success", title: "Campanhas", message: "Histórico limpo." });
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao limpar." });
    } finally {
      setClearing(false);
    }
  }

  const statusLabel: Record<string, string> = {
    draft: "Rascunho",
    queued: "Agendada",
    sent: "Enviada",
    failed: "Falhou",
    paused: "Pausada",
  };

  const statusColor: Record<string, "default" | "success" | "error" | "warning"> = {
    draft: "default",
    queued: "warning",
    sent: "success",
    failed: "error",
    paused: "default",
  };

  const MediaIcon = mediaFile
    ? mediaFile.type === "image"
      ? ImageIcon
      : mediaFile.type === "video"
      ? VideoFileIcon
      : mediaFile.type === "audio"
      ? AudioFileIcon
      : DescriptionIcon
    : AttachFileIcon;

  return (
    <PageContainer
      title="Campanhas"
      subtitle="Crie e envie mensagens com mídia para seus grupos do WhatsApp"
      actions={
        <Stack direction="row" spacing={1} alignItems="center">
          {limits && (
            <Chip
              label={`${campaignsToday.usedToday}/${campaignsToday.limit} envios/dia`}
              size="small"
              color={atDailyLimit ? "warning" : "default"}
              variant="outlined"
            />
          )}
          <Button variant="outlined" size="medium" onClick={loadAll} disabled={loading}>
            Atualizar
          </Button>
        </Stack>
      }
    >
      <Stack spacing={3}>
        {/* Área principal: Formulário + Preview */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 320px" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Paper sx={{ p: 3, overflow: "hidden" }} elevation={0} variant="outlined">
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: "text.primary" }}>
              Nova campanha
            </Typography>
            <form onSubmit={handleCreate}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Título (opcional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" }, bgcolor: "transparent" }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 48 }}>
                    <Typography variant="body2" color="text.secondary">
                      Gerador de mensagem (opcional)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                    <MessageGenerator
                      value={messageText}
                      onChange={setMessageText}
                      productId={selectedProductId || undefined}
                      onProductChange={setSelectedProductId}
                      templateId={templateIdForCampaign}
                      onTemplateChange={setTemplateIdForCampaign}
                    />
                  </AccordionDetails>
                </Accordion>

                <TextField
                  fullWidth
                  size="small"
                  label="Mensagem"
                  multiline
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite o texto da campanha..."
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Link (opcional)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Mídia
                  </Typography>
                  <Box
                    sx={{
                      border: "2px dashed",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      bgcolor: "action.hover",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <input
                      type="file"
                      accept={ACCEPT_MEDIA}
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                      id="campaign-media-input"
                    />
                    {mediaFile ? (
                      <>
                        <MediaIcon color="primary" fontSize="small" />
                        <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {mediaFile.file.name}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <label htmlFor="campaign-media-input">
                            <Button size="small" variant="outlined" component="span">
                              Trocar
                            </Button>
                          </label>
                          <Button size="small" variant="text" color="error" onClick={() => setMediaFile(null)}>
                            Remover
                          </Button>
                        </Stack>
                      </>
                    ) : (
                      <label htmlFor="campaign-media-input" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 1 }}>
                        <AttachFileIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Imagens, vídeos, áudios, documentos (até 16MB)
                        </Typography>
                      </label>
                    )}
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.50"),
                    color: "text.primary",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                      Grupos destino
                    </Typography>
                    <Chip
                      label={`${selectedGroupIds.length}/${maxGroups} selecionado${selectedGroupIds.length !== 1 ? "s" : ""}`}
                      size="small"
                      color={selectedGroupIds.length > 0 ? "primary" : "default"}
                    />
                  </Box>
                  {groups.length > 0 && (
                    <TextField
                      size="small"
                      placeholder="Pesquisar grupo..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      sx={{ mb: 1.5, "& .MuiInputBase-root": { bgcolor: "background.paper" } }}
                      fullWidth
                    />
                  )}
                  {!canSelectMoreGroups && (
                    <Typography variant="caption" color="warning.main" sx={{ display: "block", mb: 1 }}>
                      Limite do plano: máximo {maxGroups} grupo(s) por campanha.
                    </Typography>
                  )}
                  {!groups.length ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                      Nenhum grupo. Sincronize em Grupos.
                    </Typography>
                  ) : !filteredGroups.length ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                      Nenhum grupo encontrado para &quot;{groupSearch}&quot;.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 160, overflowY: "auto" }}>
                      {filteredGroups.map((g) => (
                        <Box
                          key={g.id}
                          component="label"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            p: 1,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: selectedGroupIds.includes(g.id) ? "primary.main" : "divider",
                            bgcolor: selectedGroupIds.includes(g.id) ? "action.selected" : "transparent",
                            color: "text.primary",
                            cursor: selectedGroupIds.includes(g.id) || canSelectMoreGroups ? "pointer" : "not-allowed",
                            opacity: !selectedGroupIds.includes(g.id) && !canSelectMoreGroups ? 0.6 : 1,
                            transition: "all 0.2s",
                            "&:hover": canSelectMoreGroups || selectedGroupIds.includes(g.id) ? { borderColor: "primary.main" } : {},
                          }}
                        >
                          <Checkbox
                            checked={selectedGroupIds.includes(g.id)}
                            onChange={() => toggleGroup(g.id)}
                            disabled={!selectedGroupIds.includes(g.id) && !canSelectMoreGroups}
                            size="small"
                            sx={{ p: 0.25 }}
                          />
                          <Avatar src={g.avatarUrl ?? undefined} sx={{ width: 28, height: 28, bgcolor: "#25D366" }}>
                            <GroupOutlined sx={{ fontSize: 16 }} />
                          </Avatar>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 140 }} color="text.primary">
                            {g.name}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={sendNow}
                        onChange={(e) => setSendNow(e.target.checked)}
                        disabled={scheduleEnabled || atDailyLimit}
                        size="small"
                      />
                    }
                    label={atDailyLimit ? `Enviar agora (limite diário: ${campaignsToday.usedToday}/${campaignsToday.limit})` : "Enviar agora"}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={scheduleEnabled}
                        onChange={(e) => setScheduleEnabled(e.target.checked)}
                        disabled={sendNow || atDailyLimit}
                        size="small"
                      />
                    }
                    label={atDailyLimit ? `Agendar (limite diário atingido)` : "Agendar"}
                  />
                  <FormControlLabel
                    control={<Checkbox checked={mentionAll} onChange={(e) => setMentionAll(e.target.checked)} size="small" />}
                    label="Mencionar Todos"
                  />
                  {scheduleEnabled && (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <TextField
                        size="small"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 140 }}
                      />
                      <TextField
                        size="small"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 100 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Repetir</InputLabel>
                        <Select value={repeatRule} label="Repetir" onChange={(e) => setRepeatRule(e.target.value as "none" | "daily" | "weekly")}>
                          <MenuItem value="none">Não</MenuItem>
                          <MenuItem value="daily">Diário</MenuItem>
                          <MenuItem value="weekly">Semanal</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  )}
                </Box>

                <Button
                  variant="contained"
                  type="submit"
                  disabled={loading || (atDailyLimit && (sendNow || scheduleEnabled))}
                  size="large"
                  fullWidth
                >
                  {loading ? "Salvando..." : atDailyLimit && (sendNow || scheduleEnabled) ? "Limite diário atingido" : "Criar campanha"}
                </Button>
              </Stack>
            </form>
          </Paper>

          <Paper sx={{ p: 2, position: "sticky", top: 16 }} elevation={0} variant="outlined">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "text.secondary" }}>
              Preview
            </Typography>
            <GroupConversationPreview
              message={messageText}
              mediaFile={mediaFile}
              groupName={previewGroupName}
              participantCount={previewGroup?.participantCount ?? undefined}
            />
            {!messageText.trim() && !mediaFile && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {selectedGroupIds.length > 0 ? "Digite a mensagem para ver o preview." : "Selecione grupos para ver o preview."}
              </Typography>
            )}
          </Paper>
        </Box>

        <Divider />

        {/* Histórico */}
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Histórico
            </Typography>
            {campaigns.length > 0 && (
              <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={clearAllCampaigns} disabled={clearing}>
                Limpar todas
              </Button>
            )}
          </Box>

          {campaigns.length === 0 && !loading ? (
            <Paper sx={{ p: 4, textAlign: "center" }} variant="outlined">
              <Typography color="text.secondary">Nenhuma campanha. Crie uma acima.</Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {campaigns.map((c) => (
                <Paper
                  key={c.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 2,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {c.title || "Sem título"}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {c.messageText}
                      {c.imagePath && " 📎"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      {(c.targets || []).length} grupo(s)
                      {c.scheduledAt && (
                        <>
                          {" · "}
                          <ScheduleIcon sx={{ fontSize: 12, verticalAlign: "middle", mr: 0.25 }} />
                          {new Date(c.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </>
                      )}
                    </Typography>
                    {c.status === "failed" && c.errorMessage && (
                      <Alert severity="warning" sx={{ mt: 1, py: 0, px: 1 }} variant="outlined">
                        {c.errorMessage}
                      </Alert>
                    )}
                  </Box>
                  <Chip
                    label={statusLabel[c.status] || c.status}
                    size="small"
                    color={statusColor[c.status] ?? "default"}
                    variant="outlined"
                  />
                  <Stack direction="row" spacing={0.5}>
                    {(c.status === "draft" || c.status === "queued") && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={() => sendCampaign(c)}
                        disabled={loading || atDailyLimit}
                      >
                        Enviar
                      </Button>
                    )}
                    <IconButton size="small" color="error" onClick={() => deleteCampaign(c)} disabled={deletingId === c.id} title="Excluir">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
      <ApiTermsDialog
        open={showTermsDialog}
        onClose={() => {
          setShowTermsDialog(false);
          pendingCreateRef.current = null;
        }}
        accepting={acceptingTerms}
        onAccept={async () => {
          setAcceptingTerms(true);
          try {
            await api.put("/settings/dispatch", { acceptApiTerms: true });
            await loadDispatchSettings();
            await pendingCreateRef.current?.();
            pendingCreateRef.current = null;
          } finally {
            setAcceptingTerms(false);
          }
        }}
      />
    </PageContainer>
  );
}

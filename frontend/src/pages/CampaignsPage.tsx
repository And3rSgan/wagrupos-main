import { FormEvent, useEffect, useState, useCallback, useRef } from "react";
import { api, getMediaUrl } from "../api";
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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import LinearProgress from "@mui/material/LinearProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import EditIcon from "@mui/icons-material/Edit";
import DialogActions from "@mui/material/DialogActions";
import { onCampaignUpdated } from "../socket/whatsappSocket";

/** Tipos de mídia e documentos aceitos na campanha. MIME + extensões para máximo compatibilidade (navegadores/OS). */
const ACCEPT_MEDIA = [
  "image/*",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "video/*",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "video/x-msvideo",
  "audio/*",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/opus",
  "audio/mp4",
  "audio/webm",
  "audio/x-m4a",
  "audio/aac",
  "audio/amr",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".mp4",
  ".webm",
  ".mov",
  ".3gp",
  ".mp3",
  ".ogg",
  ".opus",
  ".m4a",
  ".aac",
  ".amr",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
].join(",");

const WEEKDAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function formatNextScheduled(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  const weekday = WEEKDAY_NAMES[d.getDay()];
  const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Próxima: ${weekday}, ${dateStr} às ${timeStr}`;
}

function getMediaType(file: File): "image" | "video" | "audio" | "document" {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "document";
}

function isImagePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext ?? "");
}

type Group = { id: string; name: string };
type Session = { id: string; name: string; isDefault?: boolean };
/** Grupo com dados de sessão para exibir/filtrar por conexão (API já retorna sessionId/sessionName). */
type GroupWithSession = GroupWithAvatar & { sessionId: string; sessionName: string };
type Campaign = {
  id: string;
  title?: string | null;
  messageText: string;
  linkUrl?: string | null;
  imagePath?: string | null;
  status: string;
  errorMessage?: string | null;
  scheduledAt?: string | null;
  repeatRule?: string | null;
  repeatWeekdays?: string | null;
  createdAt: string;
  targets?: { id: string; group: Group }[];
  sends?: { id: string; groupId: string; status: string; error?: string | null; group?: { name: string } }[];
};

export default function CampaignsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupWithSession[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [connectionTab, setConnectionTab] = useState<string>("all");

  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [sendNow, setSendNow] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [repeatRule, setRepeatRule] = useState<"none" | "daily" | "weekly" | "weekdays">("none");
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]); // 0=Dom, 1=Seg, ..., 6=Sáb
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
  const [reportCampaignId, setReportCampaignId] = useState<string | null>(null);
  const [editScheduleCampaign, setEditScheduleCampaign] = useState<Campaign | null>(null);
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [editScheduleTime, setEditScheduleTime] = useState("");
  const [editRepeatRule, setEditRepeatRule] = useState<"none" | "daily" | "weekly" | "weekdays">("none");
  const [editRepeatWeekdays, setEditRepeatWeekdays] = useState<number[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessageText, setEditMessageText] = useState("");
  const [editMediaFile, setEditMediaFile] = useState<MediaFile | null>(null);
  const [editRemoveMedia, setEditRemoveMedia] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const pendingCreateRef = useRef<(() => Promise<void>) | null>(null);

  const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));
  const groupSearchLower = groupSearch.trim().toLowerCase();
  /** Grupos visíveis na aba atual (por conexão); trocar de aba NÃO limpa selectedGroupIds. */
  const groupsByTab =
    connectionTab === "all" ? groups : groups.filter((g) => g.sessionId === connectionTab);
  const filteredGroups = groupSearchLower
    ? groupsByTab.filter((g) => g.name.toLowerCase().includes(groupSearchLower))
    : groupsByTab;
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

  useEffect(() => {
    return () => {
      if (editMediaFile?.preview) URL.revokeObjectURL(editMediaFile.preview);
    };
  }, [editMediaFile?.preview]);

  async function loadGroups() {
    const res = await api.get<GroupWithSession[]>("/groups");
    setGroups(res.data);
  }

  async function loadSessions() {
    const res = await api.get<{ id: string; name: string; isDefault?: boolean }[]>("/whatsapp/sessions");
    const list = res.data.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault }));
    setSessions(list);
    return list;
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
      const [_, sessionsList] = await Promise.all([
        Promise.all([loadGroups(), loadCampaigns(), loadLimits(), loadDispatchSettings()]),
        loadSessions(),
      ]);
      if (connectionTab !== "all" && sessionsList && !sessionsList.some((s) => s.id === connectionTab)) {
        setConnectionTab("all");
      }
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

  const hasQueued = campaigns.some((c) => c.status === "queued");
  useEffect(() => {
    if (!hasQueued) return;
    const interval = setInterval(() => void loadCampaigns(), 4000);
    return () => clearInterval(interval);
  }, [hasQueued]);

  useEffect(() => {
    const unsub = onCampaignUpdated(() => void loadCampaigns());
    return unsub;
  }, []);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxGroups) return prev;
      return [...prev, id];
    });
  }

  /** Seleciona todos os grupos da aba/conexão atual (e da busca), respeitando o limite do plano. */
  function selectAllCurrentTab() {
    const ids = filteredGroups.map((g) => g.id);
    setSelectedGroupIds((prev) => {
      const combined = [...new Set([...prev, ...ids])];
      return combined.slice(0, maxGroups);
    });
  }

  /** Remove todos os grupos da seleção. */
  function deselectAll() {
    setSelectedGroupIds([]);
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
      if (repeatRule === "weekdays" && repeatWeekdays.length > 0) {
        fd.append("repeatWeekdays", JSON.stringify(repeatWeekdays));
      }
    }
    if (mediaFile) fd.append("image", mediaFile.file);

    setUploadProgress(0);
    try {
      const res = await api.post<Campaign>("/campaigns", fd, {
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          setUploadProgress(pct);
        },
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
    } finally {
      setUploadProgress(null);
    }
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
    toast.push({ type: "success", title: "Campanhas", message: "Campanha na fila de envio." });
    await Promise.all([loadCampaigns(), loadLimits()]);
  }

  async function pauseCampaign(c: Campaign) {
    try {
      await api.patch(`/campaigns/${c.id}/pause`);
      toast.push({ type: "success", title: "Campanhas", message: "Campanha pausada." });
      await loadCampaigns();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao pausar." });
    }
  }

  async function resumeCampaign(c: Campaign) {
    try {
      await api.patch(`/campaigns/${c.id}/resume`);
      toast.push({ type: "success", title: "Campanhas", message: "Campanha retomada." });
      await loadCampaigns();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao retomar." });
    }
  }

  async function resendFailedCampaign(c: Campaign) {
    try {
      const res = await api.patch<{ message?: string }>(`/campaigns/${c.id}/resend-failed`);
      toast.push({ type: "success", title: "Campanhas", message: res.data?.message ?? "Reenvio na fila." });
      await loadCampaigns();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao reenviar." });
    }
  }

  function openEditSchedule(c: Campaign) {
    setEditScheduleCampaign(c);
    if (c.scheduledAt) {
      const d = new Date(c.scheduledAt);
      setEditScheduleDate(d.toISOString().slice(0, 10));
      setEditScheduleTime(d.toTimeString().slice(0, 5));
    } else {
      const d = new Date();
      d.setMinutes(d.getMinutes() + 30);
      setEditScheduleDate(d.toISOString().slice(0, 10));
      setEditScheduleTime(d.toTimeString().slice(0, 5));
    }
    const rule = (c.repeatRule === "daily" || c.repeatRule === "weekly" || c.repeatRule === "weekdays" ? c.repeatRule : "none") as "none" | "daily" | "weekly" | "weekdays";
    setEditRepeatRule(rule);
    if (c.repeatWeekdays) {
      try {
        setEditRepeatWeekdays(JSON.parse(c.repeatWeekdays) as number[]);
      } catch {
        setEditRepeatWeekdays([]);
      }
    } else {
      setEditRepeatWeekdays([]);
    }
  }

  async function saveEditSchedule() {
    if (!editScheduleCampaign) return;
    const scheduledAt = editScheduleDate && editScheduleTime ? new Date(`${editScheduleDate}T${editScheduleTime}`) : null;
    if (!scheduledAt || scheduledAt <= new Date()) {
      toast.push({ type: "warning", title: "Campanhas", message: "Informe data e horário futuros." });
      return;
    }
    setSavingSchedule(true);
    try {
      const payload: { scheduledAt: string; repeatRule: string; repeatWeekdays?: string } = {
        scheduledAt: scheduledAt.toISOString(),
        repeatRule: editRepeatRule,
      };
      if (editRepeatRule === "weekdays" && editRepeatWeekdays.length > 0) {
        payload.repeatWeekdays = JSON.stringify(editRepeatWeekdays);
      }
      await api.patch(`/campaigns/${editScheduleCampaign.id}`, payload);
      toast.push({ type: "success", title: "Campanhas", message: "Agendamento atualizado." });
      setEditScheduleCampaign(null);
      await loadCampaigns();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao atualizar." });
    } finally {
      setSavingSchedule(false);
    }
  }

  function openEditCampaign(c: Campaign) {
    setEditCampaign(c);
    setEditTitle(c.title ?? "");
    setEditMessageText(c.messageText ?? "");
    setEditMediaFile(null);
    setEditRemoveMedia(false);
  }

  const handleEditFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setEditMediaFile(null);
      return;
    }
    const type = getMediaType(file);
    const preview = type === "image" || type === "video" ? URL.createObjectURL(file) : undefined;
    setEditMediaFile({ file, type, preview });
    setEditRemoveMedia(false);
  }, []);

  async function saveEditCampaign() {
    if (!editCampaign) return;
    if (!editMessageText.trim()) {
      toast.push({ type: "warning", title: "Campanhas", message: "Informe a mensagem." });
      return;
    }
    setSavingEdit(true);
    try {
      const fd = new FormData();
      fd.append("messageText", editMessageText.trim());
      fd.append("title", editTitle.trim());
      if (editRemoveMedia) fd.append("removeImage", "true");
      if (editMediaFile?.file) fd.append("image", editMediaFile.file);
      const res = await api.put<Campaign>(`/campaigns/${editCampaign.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCampaigns((prev) => prev.map((c) => (c.id === res.data.id ? res.data : c)));
      setEditCampaign(null);
      toast.push({ type: "success", title: "Campanhas", message: "Campanha atualizada." });
      await loadCampaigns();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Campanhas", message: e?.response?.data?.message ?? "Erro ao atualizar." });
    } finally {
      setSavingEdit(false);
    }
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
    queued: "Na fila",
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
                        {uploadProgress === null && (
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
                        )}
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
                  {uploadProgress !== null && (
                    <Box sx={{ width: "100%", mt: 1.5 }}>
                      <LinearProgress
                        variant="determinate"
                        value={uploadProgress}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Enviando arquivo... {uploadProgress}%
                      </Typography>
                    </Box>
                  )}
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
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                      Grupos destino
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Chip
                        label={`${selectedGroupIds.length}/${maxGroups} selecionado${selectedGroupIds.length !== 1 ? "s" : ""}`}
                        size="small"
                        color={selectedGroupIds.length > 0 ? "primary" : "default"}
                      />
                      {filteredGroups.length > 0 && (
                        <>
                          <Button
                            size="small"
                            variant="text"
                            onClick={selectAllCurrentTab}
                            disabled={!canSelectMoreGroups && filteredGroups.every((g) => selectedGroupIds.includes(g.id))}
                          >
                            Selecionar todos{connectionTab !== "all" ? " (desta conexão)" : ""}
                          </Button>
                          <Button size="small" variant="text" color="secondary" onClick={deselectAll} disabled={selectedGroupIds.length === 0}>
                            Desmarcar todos
                          </Button>
                        </>
                      )}
                    </Box>
                  </Box>
                  {sessions.length > 1 && (
                    <Tabs
                      value={connectionTab}
                      onChange={(_, value) => setConnectionTab(value)}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{ mb: 1.5, minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 0 } }}
                    >
                      <Tab label="Todas" value="all" />
                      {sessions.map((s) => (
                        <Tab
                          key={s.id}
                          label={`${s.name} (${groups.filter((g) => g.sessionId === s.id).length})`}
                          value={s.id}
                        />
                      ))}
                    </Tabs>
                  )}
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
                        <Select value={repeatRule} label="Repetir" onChange={(e) => setRepeatRule(e.target.value as "none" | "daily" | "weekly" | "weekdays")}>
                          <MenuItem value="none">Não</MenuItem>
                          <MenuItem value="daily">Diário</MenuItem>
                          <MenuItem value="weekly">Semanal</MenuItem>
                          <MenuItem value="weekdays">Dias da semana</MenuItem>
                        </Select>
                      </FormControl>
                      {repeatRule === "weekdays" && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Dias:</Typography>
                          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, i) => (
                            <FormControlLabel
                              key={i}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={repeatWeekdays.includes(i)}
                                  onChange={(e) => {
                                    if (e.target.checked) setRepeatWeekdays((prev) => [...prev, i].sort((a, b) => a - b));
                                    else setRepeatWeekdays((prev) => prev.filter((d) => d !== i));
                                  }}
                                />
                              }
                              label={label}
                            />
                          ))}
                        </Box>
                      )}
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
                          {(c.repeatRule === "daily" || c.repeatRule === "weekly" || c.repeatRule === "weekdays")
                            ? formatNextScheduled(c.scheduledAt)
                            : new Date(c.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </>
                      )}
                    </Typography>
                    {c.status === "failed" && c.errorMessage && (
                      <Alert severity="warning" sx={{ mt: 1, py: 0, px: 1 }} variant="outlined">
                        {c.errorMessage}
                      </Alert>
                    )}
                    {(c.status === "queued" || c.status === "sent" || c.status === "failed") &&
                      (c.targets?.length ?? 0) > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={
                            c.sends?.length
                              ? Math.round(
                                  (100 * (c.sends?.filter((s) => s.status === "sent" || s.status === "failed").length ?? 0)) /
                                    (c.targets?.length ?? 1)
                                )
                              : 0
                          }
                          color={c.status === "failed" ? "warning" : "primary"}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          {c.sends?.filter((s) => s.status === "sent").length ?? 0} enviados ·{" "}
                          {c.sends?.filter((s) => s.status === "failed").length ?? 0} falhas ·{" "}
                          {c.sends?.filter((s) => s.status === "pending").length ?? 0} pendentes
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Chip
                    label={statusLabel[c.status] || c.status}
                    size="small"
                    color={statusColor[c.status] ?? "default"}
                    variant="outlined"
                  />
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(c.status === "draft" || c.status === "queued") && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={() => sendCampaign(c)}
                        disabled={loading || atDailyLimit || c.status === "queued"}
                      >
                        Enviar
                      </Button>
                    )}
                    {c.status === "queued" && (
                      <Button size="small" variant="outlined" startIcon={<PauseIcon />} onClick={() => pauseCampaign(c)}>
                        Pausar
                      </Button>
                    )}
                    {c.status === "paused" && (
                      <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={() => resumeCampaign(c)}>
                        Retomar
                      </Button>
                    )}
                    {["draft", "queued", "paused"].includes(c.status) && (
                      <>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openEditCampaign(c)}>
                          Editar
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<EditCalendarIcon />} onClick={() => openEditSchedule(c)}>
                          Editar agendamento
                        </Button>
                      </>
                    )}
                    {(c.status === "sent" || c.status === "failed") &&
                      (c.sends?.filter((s) => s.status === "failed").length ?? 0) > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<RefreshIcon />}
                          onClick={() => resendFailedCampaign(c)}
                        >
                          Reenviar falhas
                        </Button>
                      )}
                    <IconButton size="small" onClick={() => setReportCampaignId(c.id)} title="Relatório">
                      <AssessmentIcon fontSize="small" />
                    </IconButton>
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
      <Dialog open={!!reportCampaignId} onClose={() => setReportCampaignId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Relatório de envios</DialogTitle>
        <DialogContent>
          {reportCampaignId && (() => {
            const c = campaigns.find((x) => x.id === reportCampaignId);
            if (!c) return null;
            const total = c.targets?.length ?? 0;
            const sendsByGroup = new Map<string, { status: string; error?: string | null }>();
            c.sends?.forEach((s) => sendsByGroup.set(s.groupId, { status: s.status, error: s.error }));
            const sent = c.sends?.filter((s) => s.status === "sent").length ?? 0;
            const failed = c.sends?.filter((s) => s.status === "failed").length ?? 0;
            const pending = c.sends?.filter((s) => s.status === "pending").length ?? 0;
            return (
              <Box sx={{ pt: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {c.title || "Sem título"} · {total} grupo(s) · {sent} enviados, {failed} falhas, {pending} pendentes
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={total ? Math.round((100 * (sent + failed)) / total) : 0}
                  color={failed > 0 ? "warning" : "primary"}
                  sx={{ height: 8, borderRadius: 1, mb: 2 }}
                />
                <Stack spacing={0.5} sx={{ maxHeight: 320, overflowY: "auto" }}>
                  {c.targets?.map((t) => {
                    const s = sendsByGroup.get(t.group.id);
                    const status = s?.status ?? "pending";
                    return (
                      <Box
                        key={t.id}
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 1,
                          py: 0.75,
                          px: 1,
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: status === "sent" ? "success.main" : status === "failed" ? "error.main" : "divider",
                          bgcolor: status === "sent" ? "success.light" : status === "failed" ? "error.light" : "action.hover",
                        }}
                      >
                        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                          {t.group.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={status === "sent" ? "Enviado" : status === "failed" ? "Falha" : "Pendente"}
                          color={status === "sent" ? "success" : status === "failed" ? "error" : "default"}
                          variant="outlined"
                        />
                        {status === "failed" && s?.error && (
                          <Typography variant="caption" color="error.dark" sx={{ width: "100%" }}>
                            {s.error}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editScheduleCampaign} onClose={() => setEditScheduleCampaign(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar agendamento</DialogTitle>
        <DialogContent>
          {editScheduleCampaign && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                size="small"
                type="date"
                label="Data"
                value={editScheduleDate}
                onChange={(e) => setEditScheduleDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                size="small"
                type="time"
                label="Horário"
                value={editScheduleTime}
                onChange={(e) => setEditScheduleTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Repetir</InputLabel>
                <Select
                  value={editRepeatRule}
                  label="Repetir"
                  onChange={(e) => setEditRepeatRule(e.target.value as "none" | "daily" | "weekly" | "weekdays")}
                >
                  <MenuItem value="none">Não (única vez)</MenuItem>
                  <MenuItem value="daily">Diário</MenuItem>
                  <MenuItem value="weekly">Semanal</MenuItem>
                  <MenuItem value="weekdays">Dias da semana</MenuItem>
                </Select>
              </FormControl>
              {editRepeatRule === "weekdays" && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: "100%", mb: 0.5 }}>Dias:</Typography>
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, i) => (
                    <FormControlLabel
                      key={i}
                      control={
                        <Checkbox
                          size="small"
                          checked={editRepeatWeekdays.includes(i)}
                          onChange={(e) => {
                            if (e.target.checked) setEditRepeatWeekdays((prev) => [...prev, i].sort((a, b) => a - b));
                            else setEditRepeatWeekdays((prev) => prev.filter((d) => d !== i));
                          }}
                        />
                      }
                      label={label}
                    />
                  ))}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEditScheduleCampaign(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveEditSchedule} disabled={savingSchedule}>
            {savingSchedule ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!editCampaign} onClose={() => setEditCampaign(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar campanha</DialogTitle>
        <DialogContent>
          {editCampaign && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                size="small"
                label="Título"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                fullWidth
                placeholder="Opcional"
              />
              <TextField
                size="small"
                label="Mensagem"
                value={editMessageText}
                onChange={(e) => setEditMessageText(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                required
              />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
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
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="file"
                    accept={ACCEPT_MEDIA}
                    onChange={handleEditFileChange}
                    style={{ display: "none" }}
                    id="edit-campaign-media-input"
                  />
                  {editRemoveMedia ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Mídia removida (será salva ao clicar em Salvar)
                      </Typography>
                      <Button size="small" variant="text" onClick={() => setEditRemoveMedia(false)}>
                        Desfazer
                      </Button>
                    </>
                  ) : editMediaFile ? (
                    <>
                      {editMediaFile.type === "image" && editMediaFile.preview && (
                        <Box component="img" src={editMediaFile.preview} alt="" sx={{ maxHeight: 80, maxWidth: 120, objectFit: "contain", borderRadius: 1 }} />
                      )}
                      {editMediaFile.type === "video" && editMediaFile.preview && (
                        <Box component="video" src={editMediaFile.preview} controls sx={{ maxHeight: 80, maxWidth: 160, borderRadius: 1 }} />
                      )}
                      {(editMediaFile.type === "audio" || editMediaFile.type === "document" || (editMediaFile.type === "image" && !editMediaFile.preview)) && (
                        <>
                          {editMediaFile.type === "audio" && <AudioFileIcon color="action" />}
                          {editMediaFile.type === "document" && <DescriptionIcon color="action" />}
                          {editMediaFile.type === "image" && !editMediaFile.preview && <ImageIcon color="action" />}
                          <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {editMediaFile.file.name}
                          </Typography>
                        </>
                      )}
                      <Stack direction="row" spacing={1}>
                        <label htmlFor="edit-campaign-media-input">
                          <Button size="small" variant="outlined" component="span">
                            Trocar
                          </Button>
                        </label>
                        <Button size="small" variant="text" color="error" onClick={() => setEditMediaFile(null)}>
                          Remover
                        </Button>
                      </Stack>
                    </>
                  ) : editCampaign.imagePath ? (
                    <>
                      {isImagePath(editCampaign.imagePath) ? (
                        <Box
                          component="img"
                          src={getMediaUrl(editCampaign.imagePath)}
                          alt=""
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          sx={{ maxHeight: 80, maxWidth: 120, objectFit: "contain", borderRadius: 1 }}
                        />
                      ) : (
                        <AttachFileIcon fontSize="small" color="action" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {isImagePath(editCampaign.imagePath) ? "Mídia atual da campanha" : "Arquivo anexado"}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <label htmlFor="edit-campaign-media-input">
                          <Button size="small" variant="outlined" component="span">
                            Trocar
                          </Button>
                        </label>
                        <Button size="small" variant="text" color="error" onClick={() => setEditRemoveMedia(true)}>
                          Remover
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <label htmlFor="edit-campaign-media-input" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 1 }}>
                      <AttachFileIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma mídia · Clique para adicionar
                      </Typography>
                    </label>
                  )}
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setEditCampaign(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveEditCampaign} disabled={savingEdit}>
            {savingEdit ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
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

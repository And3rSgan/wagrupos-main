import { FormEvent, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";
import { GroupCard, type GroupWithAvatar } from "../components/GroupCard";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Autocomplete from "@mui/material/Autocomplete";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import GroupsIcon from "@mui/icons-material/Groups";
import { ApiTermsDialog } from "../components/ApiTermsDialog";

export default function GroupSenderPage() {
  const [groups, setGroups] = useState<GroupWithAvatar[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<GroupWithAvatar[]>([]);
  const [message, setMessage] = useState("");
  const [mentionAll, setMentionAll] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sending, setSending] = useState(false);
  const [limits, setLimits] = useState<{ usedToday: number; limit: number } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [dispatchSettings, setDispatchSettings] = useState<{ apiTermsAcceptedAt: string | null } | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const pendingSendRef = useRef<(() => Promise<void>) | null>(null);
  const navigate = useNavigate();

  const atDailyLimit = limits ? limits.usedToday >= limits.limit : false;

  useEffect(() => {
    void loadGroups();
  }, []);

  useEffect(() => {
    api
      .get<{ campaignsPerDay: { usedToday: number; limit: number } }>("/campaigns/limits")
      .then((res) => setLimits(res.data.campaignsPerDay))
      .catch(() => setLimits(null));
  }, []);

  useEffect(() => {
    api
      .get<{ apiTermsAcceptedAt: string | null }>("/settings/dispatch")
      .then((res) => setDispatchSettings(res.data))
      .catch(() => setDispatchSettings(null));
  }, []);

  async function loadGroups() {
    setLoadingGroups(true);
    setFeedback(null);
    try {
      const res = await api.get<GroupWithAvatar[]>("/groups");
      setGroups(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        navigate("/login");
        return;
      }
      setFeedback({ type: "error", message: "Erro ao carregar grupos. Tente sincronizar novamente." });
    } finally {
      setLoadingGroups(false);
    }
  }

  async function handleSync() {
    setLoadingGroups(true);
    setFeedback(null);
    try {
      await api.post("/groups/sync");
      await loadGroups();
      setFeedback({ type: "success", message: "Grupos sincronizados com sucesso." });
    } catch {
      setLoadingGroups(false);
      setFeedback({ type: "error", message: "Erro ao sincronizar grupos." });
    }
  }

  async function doSend() {
    if (selectedGroups.length === 0) return;
    await api.post("/whatsapp/send", {
      groupIds: selectedGroups.map((g) => g.id),
      message,
      mentionAll,
    });
    setMessage("");
    setSelectedGroups([]);
    setFeedback({ type: "success", message: "Mensagem enviada com sucesso!" });
    const limitsRes = await api.get<{ campaignsPerDay: { usedToday: number; limit: number } }>("/campaigns/limits");
    setLimits(limitsRes.data.campaignsPerDay);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (atDailyLimit) {
      setFeedback({
        type: "warning",
        message: `Limite diário atingido (${limits?.usedToday}/${limits?.limit} envios). Amanhã será liberado.`,
      });
      return;
    }
    if (!selectedGroups.length || !message.trim()) {
      setFeedback({ type: "warning", message: "Selecione ao menos um grupo e escreva a mensagem." });
      return;
    }
    if (!dispatchSettings?.apiTermsAcceptedAt) {
      pendingSendRef.current = async () => {
        setSending(true);
        setFeedback(null);
        try {
          await doSend();
        } catch (err: any) {
          setFeedback({
            type: "error",
            message: err?.response?.data?.message ?? "Erro ao enviar mensagem.",
          });
        } finally {
          setSending(false);
        }
      };
      setShowTermsDialog(true);
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      await doSend();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message ?? "Erro ao enviar mensagem.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <PageContainer
      title="Disparo em grupos do WhatsApp"
      subtitle="Conecte seu WhatsApp e envie campanhas para grupos selecionados."
      actions={
        <Button variant="contained" color="primary" onClick={handleSync} disabled={loadingGroups}>
          {loadingGroups ? "Sincronizando..." : "Sincronizar grupos"}
        </Button>
      }
    >
      {feedback && (
        <Alert severity={feedback.type} sx={{ mb: 2 }}>
          {feedback.message}
        </Alert>
      )}

      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
        <Autocomplete
          multiple
          value={selectedGroups}
          onChange={(_, v) => setSelectedGroups(v)}
          options={groups}
          getOptionLabel={(g) => g.name}
          loading={loadingGroups}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterSelectedOptions
          renderInput={(params) => (
            <TextField
              {...params}
              label="Grupos"
              placeholder="Pesquise e selecione um ou mais grupos..."
            />
          )}
          renderOption={(props, g) => (
            <li {...props} key={g.id}>
              <GroupCard group={g} size="sm" />
            </li>
          )}
          slotProps={{
            popper: {
              sx: { "& .MuiAutocomplete-listbox": { maxHeight: 320 } },
            },
          }}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Mensagem"
          multiline
          rows={6}
          placeholder="Texto da promoção, link da Shopee, etc..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          helperText={
            selectedGroups.length === 0
              ? "Selecione um ou mais grupos."
              : `A mensagem será enviada para ${selectedGroups.length} grupo(s).`
          }
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={mentionAll}
              onChange={(e) => setMentionAll(e.target.checked)}
              color="primary"
            />
          }
          label="Mencionar Todos — notifica todos do grupo sem incluir @ na mensagem (menção fantasma)"
          sx={{ mb: 2, display: "block" }}
        />

        {atDailyLimit && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Limite diário de envios para grupos atingido ({limits?.usedToday}/{limits?.limit}). Disparos e campanhas
            “Enviar agora” ficam bloqueados até amanhã.
          </Alert>
        )}
        <Button variant="contained" color="primary" type="submit" disabled={sending || atDailyLimit}>
          {sending ? "Enviando..." : atDailyLimit ? "Limite diário atingido" : "Disparar mensagem"}
        </Button>
      </Paper>

      <ApiTermsDialog
        open={showTermsDialog}
        onClose={() => {
          setShowTermsDialog(false);
          pendingSendRef.current = null;
        }}
        accepting={acceptingTerms}
        onAccept={async () => {
          setAcceptingTerms(true);
          try {
            await api.put("/settings/dispatch", { acceptApiTerms: true });
            const res = await api.get<{ apiTermsAcceptedAt: string | null }>("/settings/dispatch");
            setDispatchSettings(res.data);
            await pendingSendRef.current?.();
            pendingSendRef.current = null;
          } finally {
            setAcceptingTerms(false);
          }
        }}
      />
    </PageContainer>
  );
}

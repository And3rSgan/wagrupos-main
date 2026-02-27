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
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import GroupsIcon from "@mui/icons-material/Groups";
import { ApiTermsDialog } from "../components/ApiTermsDialog";

type Session = { id: string; name: string; isDefault?: boolean };
type GroupWithSession = GroupWithAvatar & { sessionId: string; sessionName?: string };

export default function GroupSenderPage() {
  const [groups, setGroups] = useState<GroupWithSession[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<GroupWithAvatar[]>([]);
  const [connectionTab, setConnectionTab] = useState<string>("all");
  const [groupSearch, setGroupSearch] = useState("");
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

  const groupsByTab =
    connectionTab === "all" ? groups : groups.filter((g) => g.sessionId === connectionTab);
  const groupSearchLower = groupSearch.trim().toLowerCase();
  const filteredGroups = groupSearchLower
    ? groupsByTab.filter((g) => g.name.toLowerCase().includes(groupSearchLower))
    : groupsByTab;

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
      const [groupsRes, sessionsRes] = await Promise.all([
        api.get<GroupWithSession[]>("/groups"),
        api.get<Session[]>("/whatsapp/sessions"),
      ]);
      setGroups(groupsRes.data);
      setSessions(sessionsRes.data.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault })));
      if (connectionTab !== "all" && !sessionsRes.data.some((s) => s.id === connectionTab)) {
        setConnectionTab("all");
      }
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

  /** Seleciona todos os grupos da aba/conexão atual (e da busca). Adiciona à seleção existente. */
  function selectAllCurrentTab() {
    setSelectedGroups((prev) => {
      const prevIds = new Set(prev.map((g) => g.id));
      const toAdd = filteredGroups.filter((g) => !prevIds.has(g.id));
      return toAdd.length === 0 ? prev : [...prev, ...toAdd];
    });
  }

  /** Remove todos os grupos da seleção. */
  function deselectAll() {
    setSelectedGroups([]);
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
        {sessions.length > 1 && (
          <Tabs
            value={connectionTab}
            onChange={(_, value) => setConnectionTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 0 } }}
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <TextField
            size="small"
            placeholder="Pesquisar grupo..."
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            sx={{ flex: "1 1 200px", minWidth: 200, "& .MuiInputBase-root": { bgcolor: "background.paper" } }}
          />
          {filteredGroups.length > 0 && (
            <>
              <Button size="small" variant="outlined" onClick={selectAllCurrentTab}>
                Selecionar todos{connectionTab !== "all" ? " (desta conexão)" : ""}
              </Button>
              <Button size="small" variant="outlined" color="secondary" onClick={deselectAll} disabled={selectedGroups.length === 0}>
                Desmarcar todos
              </Button>
            </>
          )}
        </Box>
        <Autocomplete
          multiple
          value={selectedGroups}
          onChange={(_, v) => setSelectedGroups(v)}
          options={filteredGroups}
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

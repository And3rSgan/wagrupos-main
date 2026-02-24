import { useEffect, useState, useRef } from "react";
import { keyframes } from "@emotion/react";
import { api } from "../api";
import { useToast } from "../toast/ToastContext";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SyncIcon from "@mui/icons-material/Sync";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";

type Group = {
  id: string;
  waId: string;
  name: string;
  participantCount?: number | null;
  avatarUrl?: string | null;
  source: string;
  createdAt: string;
  sessionId: string;
  sessionName: string;
};

type Session = { id: string; name: string; isDefault?: boolean };

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export default function GroupsPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredGroups = tab === "all" ? groups : groups.filter((g) => g.sessionId === tab);

  async function load() {
    setLoading(true);
    try {
      const [groupsRes, sessionsRes] = await Promise.all([
        api.get<Group[]>("/groups"),
        api.get<Session[]>("/whatsapp/sessions"),
      ]);
      setGroups(groupsRes.data);
      setSessions(sessionsRes.data.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault })));
      if (tab !== "all" && !sessionsRes.data.some((s) => s.id === tab)) {
        setTab("all");
      }
    } catch (e: any) {
      toast.push({
        type: "danger",
        title: "Grupos",
        message: e?.response?.data?.message ?? "Erro ao carregar grupos.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const [groupsRes, sessionsRes] = await Promise.all([
        api.post<Group[]>("/groups/sync"),
        api.get<Session[]>("/whatsapp/sessions"),
      ]);
      setGroups(groupsRes.data);
      setSessions(sessionsRes.data.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault })));
      toast.push({ type: "success", title: "Grupos", message: "Grupos sincronizados com sucesso." });
    } catch (e: any) {
      toast.push({
        type: "danger",
        title: "Grupos",
        message: e?.response?.data?.message ?? "Erro ao sincronizar. Conecte o WhatsApp primeiro.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleExport() {
    try {
      const res = await api.get("/groups/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "grupos.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.push({ type: "success", title: "Grupos", message: "Exportação concluída." });
    } catch (e: any) {
      toast.push({ type: "danger", title: "Grupos", message: e?.response?.data?.message ?? "Erro ao exportar." });
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{ created: number; total: number; groups: Group[] }>("/groups/import", formData);
      setGroups(res.data.groups);
      toast.push({
        type: "success",
        title: "Grupos",
        message: `${res.data.created} grupo(s) importado(s). Total: ${res.data.total}`,
      });
    } catch (err: any) {
      toast.push({ type: "danger", title: "Grupos", message: err?.response?.data?.message ?? "Erro ao importar." });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <PageContainer
      title="Grupos do WhatsApp"
      subtitle="Lista completa com fotos, IDs e participantes. Sincronize, importe ou exporte grupos."
      actions={
        <>
          <Button variant="outlined" onClick={load} disabled={loading}>
            Atualizar
          </Button>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={handleImportClick} disabled={importing}>
            {importing ? "Importando..." : "Importar planilha"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
            Exportar
          </Button>
        </>
      }
    >
      {sessions.length > 0 && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab
            value="all"
            label={
              <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                Todos ({groups.length})
                <Tooltip title="Sincronizar grupos do WhatsApp">
                  <IconButton
                    component="span"
                    role="button"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync();
                    }}
                    disabled={syncing}
                    sx={{ "&:hover": { bgcolor: "action.hover" } }}
                  >
                    <SyncIcon fontSize="small" sx={syncing ? { animation: `${spin} 1s linear infinite` } : undefined} />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          />
          {sessions.map((s) => (
            <Tab
              key={s.id}
              value={s.id}
              label={
                <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {s.name} ({groups.filter((g) => g.sessionId === s.id).length})
                  <Tooltip title="Sincronizar grupos desta conexão">
                    <IconButton
                      component="span"
                      role="button"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSync();
                      }}
                      disabled={syncing}
                      sx={{ "&:hover": { bgcolor: "action.hover" } }}
                    >
                      <SyncIcon fontSize="small" sx={syncing ? { animation: `${spin} 1s linear infinite` } : undefined} />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            />
          ))}
        </Tabs>
      )}
      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 260px)" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}></TableCell>
                <TableCell>Nome</TableCell>
                {tab === "all" && sessions.length > 1 && <TableCell>Conexão</TableCell>}
                <TableCell>ID do grupo</TableCell>
                <TableCell align="center">Participantes</TableCell>
                <TableCell>Fonte</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGroups.map((g) => (
                <TableRow key={g.id} hover>
                  <TableCell>
                    <Avatar
                      src={g.avatarUrl ?? undefined}
                      sx={{ width: 40, height: 40, bgcolor: "#25D366" }}
                    >
                      <GroupsIcon />
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{g.name}</Typography>
                  </TableCell>
                  {tab === "all" && sessions.length > 1 && (
                    <TableCell>
                      <Chip label={g.sessionName} size="small" color="primary" variant="outlined" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {g.waId}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {g.participantCount != null ? (
                      <Chip label={g.participantCount} size="small" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={g.source === "imported" ? "Importado" : "WhatsApp"}
                      size="small"
                      variant={g.source === "imported" ? "outlined" : "filled"}
                      color={g.source === "imported" ? "default" : "success"}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!filteredGroups.length && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={tab === "all" && sessions.length > 1 ? 6 : 5}
                    sx={{ py: 4, textAlign: "center", color: "text.secondary" }}
                  >
                    Nenhum grupo. Use o ícone de sincronizar ao lado das abas para buscar do WhatsApp ou <strong>Importar planilha</strong> (CSV/Excel com colunas waId e nome).
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </PageContainer>
  );
}

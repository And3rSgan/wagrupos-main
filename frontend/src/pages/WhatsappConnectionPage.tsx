import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  joinSessionRoom,
  leaveSessionRoom,
  onQr,
  onReady,
  onDisconnected,
} from "../socket/whatsappSocket";
import { useToast } from "../toast/ToastContext";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import Avatar from "@mui/material/Avatar";
import SyncIcon from "@mui/icons-material/Sync";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PhoneIcon from "@mui/icons-material/Phone";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SettingsIcon from "@mui/icons-material/Settings";

type Session = {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
  waPushName?: string | null;
  waPhone?: string | null;
  waAvatarUrl?: string | null;
  lastConnectedAt?: string | null;
  _count?: { groups: number };
};

export default function WhatsappConnectionPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{ sessionId: string; sessionName: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editModal, setEditModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ sessionId: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Session[]>("/whatsapp/sessions");
      setSessions(res.data);
    } catch (e: any) {
      toast.push({
        type: "danger",
        title: "Conexões",
        message: e?.response?.data?.message ?? "Erro ao carregar.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const unsubRef = useRef<Array<() => void>>([]);
  const connectedHandledRef = useRef(false);

  useEffect(() => {
    if (!qrModal) {
      connectedHandledRef.current = false;
      return;
    }
    const sid = qrModal.sessionId;
    let cancelled = false;
    connectedHandledRef.current = false;

    joinSessionRoom(sid).then((ok) => {
      if (!ok || cancelled) return;
      api.get(`/whatsapp/sessions/${sid}/status`).catch(() => {}); // dispara getOrCreateClient
    });

    const unQr = onQr((sessionId, dataUrl) => {
      if (sessionId === sid && !cancelled) setQr(dataUrl);
    });
    const handleConnected = () => {
      if (cancelled || connectedHandledRef.current) return;
      connectedHandledRef.current = true;
      setQr(null);
      toast.push({ type: "success", title: "Conexões", message: "Sessão conectada com sucesso." });
      api.get(`/whatsapp/sessions/${sid}/status`).finally(() => {
        void load();
      });
      setTimeout(() => setQrModal(null), 600);
    };

    const unReady = onReady((sessionId) => {
      if (sessionId === sid) handleConnected();
    });
    const unDisc = onDisconnected((sessionId) => {
      if (sessionId === sid && !cancelled) void load();
    });
    unsubRef.current = [unQr, unReady, unDisc];

    let hadQr = false;
    const poll = async () => {
      try {
        const r = await api.get<{ qr: string | null; alreadyConnected?: boolean }>(`/whatsapp/sessions/${sid}/qr`);
        if (cancelled) return;
        if (r.data.alreadyConnected) {
          toast.push({ type: "success", title: "Conexões", message: "Sessão já conectada." });
          setQrModal(null);
          void load();
          return;
        }
        if (r.data.qr) {
          hadQr = true;
          setQr(r.data.qr);
        } else if (hadQr) {
          const statusRes = await api.get<{ status: string }>(`/whatsapp/sessions/${sid}/status`);
          if (!cancelled && statusRes.data?.status === "connected") handleConnected();
        }
      } catch {
        if (!cancelled) setQr(null);
      }
    };
    void poll();
    const id = setInterval(poll, 500);

    return () => {
      cancelled = true;
      clearInterval(id);
      leaveSessionRoom(sid);
      unsubRef.current.forEach((u) => u());
      if (!connectedHandledRef.current) {
        api.post(`/whatsapp/sessions/${sid}/release`).catch(() => {});
      }
    };
  }, [qrModal]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await api.post<Session>("/whatsapp/sessions", { name: newName.trim() });
      setSessions((prev) => [...prev, r.data]);
      setAddModal(false);
      setNewName("");
      setQrModal({ sessionId: r.data.id, sessionName: r.data.name });
      setQr(null);
      toast.push({ type: "success", title: "Conexões", message: "Conexão criada. Escaneie o QR." });
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexões", message: e?.response?.data?.message ?? "Erro." });
    } finally {
      setCreating(false);
    }
  }

  async function handleRestart(sessionId: string) {
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/restart`);
      toast.push({ type: "info", title: "Conexões", message: "Reiniciando…" });
      setQr(null);
      if (qrModal?.sessionId === sessionId) {
        setTimeout(() => setQr(null), 500);
      }
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexões", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  function handleNewQr(sessionId: string) {
    setQrModal({ sessionId, sessionName: sessions.find((s) => s.id === sessionId)?.name ?? "WhatsApp" });
    setQr(null);
  }

  async function handleDisconnect(sessionId: string) {
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/disconnect`);
      toast.push({ type: "success", title: "Conexões", message: "Desconectado." });
      if (qrModal?.sessionId === sessionId) setQrModal(null);
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexões", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  async function handleSetDefault(sessionId: string) {
    try {
      await api.put(`/whatsapp/sessions/${sessionId}/default`);
      toast.push({ type: "success", title: "Conexões", message: "Definido como padrão." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexões", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  function openDeleteConfirm(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) setDeleteConfirmModal({ sessionId, name: session.name });
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmModal) return;
    const { sessionId } = deleteConfirmModal;
    setDeleting(true);
    try {
      await api.delete(`/whatsapp/sessions/${sessionId}`);
      setDeleteConfirmModal(null);
      if (qrModal?.sessionId === sessionId) setQrModal(null);
      toast.push({ type: "success", title: "Conexões", message: "Conexão excluída." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexões", message: e?.response?.data?.message ?? "Erro." });
    } finally {
      setDeleting(false);
    }
  }

  async function handleEditSave() {
    if (!editModal) return;
    try {
      await api.put(`/whatsapp/sessions/${editModal.id}`, { name: editModal.name.trim() });
      setSessions((prev) => prev.map((s) => (s.id === editModal.id ? { ...s, name: editModal.name.trim() } : s)));
      setEditModal(null);
      toast.push({ type: "success", title: "Conexões", message: "Nome atualizado." });
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexões", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  return (
    <PageContainer
      title="Conexões"
      subtitle={`Todos os WhatsApp's · ${sessions.length} conexão(ões)`}
      actions={
        <>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddModal(true)}
            sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#128C7E" } }}
          >
            Adicionar WhatsApp
          </Button>
          <IconButton component={Link} to="/settings" title="Configurações">
            <SettingsIcon />
          </IconButton>
        </>
      }
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {sessions.map((s, idx) => (
          <Card key={s.id} sx={{ minWidth: 320, maxWidth: 380, flex: "1 1 320px" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
                <Avatar
                  src={s.waAvatarUrl ?? undefined}
                  sx={{ width: 56, height: 56, bgcolor: "#25D366" }}
                >
                  {(s.waPushName || s.name)[0].toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {s.name}
                    </Typography>
                    {s.isDefault && (
                      <Chip label="Padrão" size="small" color="success" icon={<CheckCircleIcon />} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">ID: {idx + 1}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {s.status === "connected" ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <ErrorOutlineIcon color="error" fontSize="small" />
                  )}
                  <Typography variant="body2" color={s.status === "connected" ? "success.main" : "error.main"}>
                    {s.status === "connected" ? "Conectado" : "Desconectado"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {s.waPhone ? `+${s.waPhone}` : "Número não definido"}
                  </Typography>
                </Box>
                {s.lastConnectedAt && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ScheduleIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {new Date(s.lastConnectedAt).toLocaleString("pt-BR")}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
                {s.status === "connected" && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<LinkOffIcon />}
                    onClick={() => handleDisconnect(s.id)}
                  >
                    Desconectar
                  </Button>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={() => handleRestart(s.id)}
                >
                  Tentar novamente
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<QrCode2Icon />}
                  onClick={() => handleNewQr(s.id)}
                  sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#128C7E" } }}
                >
                  Novo QR Code
                </Button>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => setEditModal({ id: s.id, name: s.name })}>
                  Editar
                </Button>
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => openDeleteConfirm(s.id)}>
                  Excluir
                </Button>
                {!s.isDefault && (
                  <Button size="small" onClick={() => handleSetDefault(s.id)}>Definir padrão</Button>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}

        {!sessions.length && !loading && (
          <Card sx={{ minWidth: 320, flex: 1 }}>
            <CardContent sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary" gutterBottom>
                Nenhuma conexão ainda.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddModal(true)}
                sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#128C7E" } }}
              >
                Adicionar WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Modal Adicionar */}
      <Dialog open={addModal} onClose={() => !creating && setAddModal(false)}>
        <DialogTitle>Nova conexão WhatsApp</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nome da conexão"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: SP1, Atendimento..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <Box sx={{ px: 3, pb: 2, display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <Button onClick={() => setAddModal(false)} disabled={creating}>Cancelar</Button>
          <Button variant="contained" onClick={handleAdd} disabled={creating || !newName.trim()}>
            {creating ? "Criando..." : "Criar"}
          </Button>
        </Box>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!deleteConfirmModal} onClose={() => !deleting && setDeleteConfirmModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Excluir conexão</DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ color: "text.primary" }}>
            Ao excluir a conexão, serão removidos permanentemente:
          </DialogContentText>
          <Box component="ul" sx={{ mt: 1, mb: 2, pl: 2.5, color: "text.secondary" }}>
            <li>A conexão WhatsApp</li>
            <li>Todos os grupos sincronizados desta conexão</li>
            <li>Todas as campanhas que usam esta conexão (rascunhos, agendadas e histórico)</li>
            <li>Envios e estatísticas relacionados</li>
          </Box>
          <DialogContentText sx={{ color: "text.secondary" }}>
            Esta ação não pode ser desfeita.
          </DialogContentText>
          {deleteConfirmModal && (
            <DialogContentText sx={{ mt: 2, fontWeight: 600 }}>
              Confirma a exclusão de &quot;{deleteConfirmModal.name}&quot;?
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmModal(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editModal} onClose={() => setEditModal(null)}>
        <DialogTitle>Editar conexão</DialogTitle>
        <DialogContent>
          {editModal && (
            <TextField
              autoFocus
              fullWidth
              label="Nome"
              value={editModal.name}
              onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <Box sx={{ px: 3, pb: 2, display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <Button onClick={() => setEditModal(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditSave}>Salvar</Button>
        </Box>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={!!qrModal} onClose={() => setQrModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Conectar ao WhatsApp Web — {qrModal?.sessionName}
          <IconButton onClick={() => setQrModal(null)} size="small">×</IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "1 1 200px" }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Conectar ao WhatsApp Web</Typography>
              <Box component="ol" sx={{ pl: 2, color: "text.secondary", "& li": { mb: 1 } }}>
                <li>Abra o WhatsApp no celular</li>
                <li>Vá em Menu ou Configurações</li>
                <li>Selecione Dispositivos conectados</li>
                <li>Aponte a câmera para o QR Code</li>
              </Box>
            </Box>
            <Box sx={{ flex: "1 1 200px", textAlign: "center" }}>
              {qr ? (
                <>
                  <img key={qr} src={qr} alt="QR Code" style={{ maxWidth: 280, width: "100%" }} />
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    O QR Code expira em ~60 segundos. Um novo é gerado automaticamente; a imagem acima atualiza sozinha.
                  </Typography>
                </>
              ) : (
                <Box sx={{ py: 4 }}>
                  <Typography color="text.secondary">Aguardando QR...</Typography>
                  <Button
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() => qrModal && handleRestart(qrModal.sessionId)}
                  >
                    Reiniciar
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

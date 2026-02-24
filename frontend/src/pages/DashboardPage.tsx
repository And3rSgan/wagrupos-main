import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import WarningIcon from "@mui/icons-material/Warning";
import MessageIcon from "@mui/icons-material/Message";
import ErrorIcon from "@mui/icons-material/Error";
import GroupsIcon from "@mui/icons-material/Groups";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";

type SessionStatus = "connected" | "qr_pending" | "disconnected" | "ban_risk";

interface DashboardData {
  sessionStatus: SessionStatus;
  sessionDetails: {
    pushName?: string | null;
    phone?: string | null;
    lastConnectedAt?: string | null;
  };
  dailyStats: {
    messagesSent: number;
    failures: number;
    groupsReached: number;
    linkClicks: number;
  };
  queue: {
    running: { id: string; title: string | null; status: string }[];
    upcoming: { id: string; title: string | null; scheduledAt: string }[];
    paused: { id: string; title: string | null }[];
  };
  alerts: string[];
}

const SESSION_LABELS: Record<SessionStatus, string> = {
  connected: "Conectado",
  qr_pending: "QR pendente",
  disconnected: "Desconectado",
  ban_risk: "Ban em risco",
};

const SESSION_COLORS: Record<SessionStatus, "success" | "warning" | "error" | "default"> = {
  connected: "success",
  qr_pending: "warning",
  disconnected: "error",
  ban_risk: "warning",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<DashboardData>("/dashboard");
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handlePause(campaignId: string) {
    setActionLoading(campaignId);
    try {
      await api.patch(`/campaigns/${campaignId}/pause`);
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResume(campaignId: string) {
    setActionLoading(campaignId);
    try {
      await api.patch(`/campaigns/${campaignId}/resume`);
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  if (loading && !data) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Erro ao carregar dashboard.</Alert>
      </Box>
    );
  }

  return (
    <PageContainer title="Visão geral" subtitle="Status da sessão, contadores e fila de campanhas">
      {/* Status da sessão */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Status da sessão
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Chip
            icon={
              data.sessionStatus === "connected" ? (
                <CheckCircleIcon />
              ) : data.sessionStatus === "qr_pending" ? (
                <QrCode2Icon />
              ) : data.sessionStatus === "ban_risk" ? (
                <WarningIcon />
              ) : (
                <LinkOffIcon />
              )
            }
            label={SESSION_LABELS[data.sessionStatus]}
            color={SESSION_COLORS[data.sessionStatus]}
            variant="filled"
          />
          {data.sessionDetails.pushName && (
            <Typography variant="body2" color="text.secondary">
              {data.sessionDetails.pushName}
              {data.sessionDetails.phone ? ` (${data.sessionDetails.phone})` : ""}
            </Typography>
          )}
          {data.sessionStatus === "disconnected" && (
            <Button component={Link} to="/whatsapp/connection" variant="outlined" size="small">
              Conectar
            </Button>
          )}
        </Box>
      </Paper>

      {/* Contadores do dia */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        Contadores do dia
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <MessageIcon color="primary" fontSize="small" />
                <Typography variant="overline" color="text.secondary">
                  Mensagens enviadas
                </Typography>
              </Box>
              <Typography variant="h4">{data.dailyStats.messagesSent}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <ErrorIcon color="error" fontSize="small" />
                <Typography variant="overline" color="text.secondary">
                  Falhas
                </Typography>
              </Box>
              <Typography variant="h4" color={data.dailyStats.failures > 0 ? "error.main" : undefined}>
                {data.dailyStats.failures}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <GroupsIcon color="primary" fontSize="small" />
                <Typography variant="overline" color="text.secondary">
                  Grupos alcançados
                </Typography>
              </Box>
              <Typography variant="h4">{data.dailyStats.groupsReached}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TouchAppIcon color="primary" fontSize="small" />
                <Typography variant="overline" color="text.secondary">
                  Cliques (links)
                </Typography>
              </Box>
              <Typography variant="h4">{data.dailyStats.linkClicks}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Fila atual */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Fila atual
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Em execução ({data.queue.running.length})
              </Typography>
              <Box sx={{ mt: 1 }}>
                {data.queue.running.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma campanha rodando
                  </Typography>
                ) : (
                  data.queue.running.map((c) => (
                    <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <PlayArrowIcon color="success" fontSize="small" />
                      <Typography variant="body2">{c.title || "Sem título"}</Typography>
                      <Button size="small" onClick={() => handlePause(c.id)} disabled={actionLoading === c.id}>
                        Pausar
                      </Button>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Próximas da fila ({data.queue.upcoming.length})
              </Typography>
              <Box sx={{ mt: 1 }}>
                {data.queue.upcoming.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma agendada
                  </Typography>
                ) : (
                  data.queue.upcoming.map((c) => (
                    <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <ScheduleIcon color="info" fontSize="small" />
                      <Typography variant="body2">{c.title || "Sem título"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(c.scheduledAt).toLocaleString("pt-BR")}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Pausadas ({data.queue.paused.length})
              </Typography>
              <Box sx={{ mt: 1 }}>
                {data.queue.paused.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma pausada
                  </Typography>
                ) : (
                  data.queue.paused.map((c) => (
                    <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <PauseIcon color="disabled" fontSize="small" />
                      <Typography variant="body2">{c.title || "Sem título"}</Typography>
                      <Button
                        size="small"
                        onClick={() => handleResume(c.id)}
                        disabled={actionLoading === c.id}
                      >
                        Retomar
                      </Button>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Alertas */}
      {data.alerts.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Alertas
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {data.alerts.map((msg, i) => (
              <Alert key={i} severity="warning">
                {msg}
              </Alert>
            ))}
          </Box>
        </Paper>
      )}

      <Box sx={{ mt: 3 }}>
        <Button component={Link} to="/campaigns" variant="contained" color="primary">
          Nova campanha / Agendar disparo
        </Button>
      </Box>
    </PageContainer>
  );
}

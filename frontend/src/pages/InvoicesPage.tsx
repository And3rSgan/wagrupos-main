import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast/ToastContext";
import { useAuth } from "../auth/AuthContext";
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
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import ContentCopy from "@mui/icons-material/ContentCopy";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TrendingUp from "@mui/icons-material/TrendingUp";

type Invoice = {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  subscription?: { plan: { name: string } } | null;
};

type Plan = { id: string; name: string; slug: string; price: number };

type PayModalData = {
  invoice: Invoice;
  qrCode: string;
  qrCodeBase64: string;
  expirationMinutes: number;
  amount: number;
};

export default function InvoicesPage() {
  const toast = useToast();
  const { me, refreshMe } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [payModal, setPayModal] = useState<PayModalData | null>(null);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [upgradePlans, setUpgradePlans] = useState<Plan[]>([]);
  const [upgradePlanId, setUpgradePlanId] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const isRestricted = me?.subscription?.isTrialExpired && !me?.subscription?.hasActivePaidAccess;

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Invoice[]>("/invoices");
      setInvoices(res.data);
      await refreshMe({ silent: true }); // atualiza subscription sem piscar o layout
    } catch (e: any) {
      toast.push({ type: "danger", title: "Faturas", message: e?.response?.data?.message ?? "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handlePay(invoice: Invoice) {
    if (invoice.status !== "pending") return;
    try {
      const res = await api.post<Record<string, unknown>>(`/invoices/${invoice.id}/pay`);
      const data = (res.data ?? {}) as Record<string, unknown>;
      const qrCode = String(data.qrCode ?? data.qr_code ?? "").trim();
      const qrCodeBase64 = String(data.qrCodeBase64 ?? data.qr_code_base64 ?? "").trim();

      if (qrCode && qrCodeBase64) {
        setPayModal({
          invoice,
          qrCode,
          qrCodeBase64: qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`,
          expirationMinutes: Number(data.expirationMinutes ?? data.expiration_minutes ?? 30),
          amount: Number(data.amount ?? invoice.amount),
        });
      } else {
        toast.push({
          type: "danger",
          title: "Pagamento PIX",
          message: String(data.message ?? "QR PIX não retornado. Execute Atualizar no instalador e verifique as chaves PIX no Mercado Pago."),
        });
      }
    } catch (e: any) {
      toast.push({ type: "danger", title: "Pagamento", message: e?.response?.data?.message ?? "Erro ao gerar PIX." });
    }
  }

  function handleCopyPix() {
    if (!payModal) return;
    navigator.clipboard.writeText(payModal.qrCode);
    toast.push({ type: "success", title: "PIX copiado", message: "Cole no app do seu banco para pagar." });
  }

  async function openUpgradeModal() {
    setUpgradeModal(true);
    try {
      const res = await api.get<Plan[]>("/invoices/plans/upgrade");
      setUpgradePlans(res.data);
      if (res.data.length > 0) setUpgradePlanId(res.data[0].id);
    } catch {
      setUpgradePlans([]);
    }
  }

  async function handleUpgrade() {
    if (!upgradePlanId) return;
    setUpgrading(true);
    try {
      await api.post("/invoices/upgrade", { planId: upgradePlanId });
      toast.push({ type: "success", title: "Upgrade", message: "Fatura criada. Pague até o fim do dia para ativar o novo plano." });
      setUpgradeModal(false);
      void load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Upgrade", message: e?.response?.data?.message ?? "Erro ao solicitar upgrade." });
    } finally {
      setUpgrading(false);
    }
  }

  const statusColor: Record<string, "default" | "success" | "warning" | "error"> = {
    pending: "warning",
    paid: "success",
    overdue: "error",
    cancelled: "default",
  };

  return (
    <PageContainer
      title="Faturas"
      subtitle="Suas faturas mensais. Pague via PIX."
      actions={
        <>
          <Button variant="outlined" startIcon={<TrendingUp />} onClick={openUpgradeModal}>
            Fazer upgrade
          </Button>
        </>
      }
    >
      {isRestricted && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: "warning.light", border: "1px solid", borderColor: "warning.main" }}>
          <Typography>
            Seu período de teste expirou. Pague sua fatura para continuar utilizando o painel.
          </Typography>
        </Paper>
      )}
      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fatura</TableCell>
                <TableCell>Plano</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>#{inv.id.slice(-8).toUpperCase()}</TableCell>
                  <TableCell>{inv.subscription?.plan?.name ?? "—"}</TableCell>
                  <TableCell>R$ {inv.amount.toFixed(2)}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Chip label={inv.status} size="small" color={statusColor[inv.status] ?? "default"} />
                  </TableCell>
                  <TableCell align="right">
                    {inv.status === "pending" && (
                      <Button size="small" variant="contained" color="primary" onClick={() => handlePay(inv)}>
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!invoices.length && !loading && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                    Nenhuma fatura. As faturas são geradas automaticamente todo mês.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={!!payModal}
        onClose={() => {
          setPayModal(null);
          void load();
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Pagamento via PIX</DialogTitle>
        <DialogContent sx={{ textAlign: "center", pt: 1 }}>
          {payModal && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Escaneie o QR code ou use o código copia e cola no app do seu banco. Ao concluir o pagamento, a fatura será baixada automaticamente.
              </Typography>
              <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                R$ {payModal.amount.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Expira em {payModal.expirationMinutes} min
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", py: 2, bgcolor: "grey.50", borderRadius: 1, mb: 2 }}>
                <img src={payModal.qrCodeBase64} alt="QR PIX" style={{ width: 200, height: 200 }} />
              </Box>
              <TextField
                fullWidth
                label="Código PIX (copia e cola)"
                value={payModal.qrCode}
                multiline
                maxRows={4}
                InputProps={{ readOnly: true }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                sx={{ mb: 1 }}
              />
              <Button variant="outlined" startIcon={<ContentCopy />} onClick={handleCopyPix} fullWidth>
                Copiar código PIX
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPayModal(null);
              void load();
            }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={upgradeModal} onClose={() => !upgrading && setUpgradeModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Fazer upgrade</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Escolha o novo plano. A fatura será gerada com vencimento para hoje. Pague via PIX no mesmo dia para ativar.
          </Typography>
          {upgradePlans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum plano disponível para upgrade no momento.
            </Typography>
          ) : (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Plano</InputLabel>
              <Select
                value={upgradePlanId}
                label="Plano"
                onChange={(e) => setUpgradePlanId(e.target.value)}
              >
                {upgradePlans.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} — R$ {p.price.toFixed(2)}/mês
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeModal(false)} disabled={upgrading}>Cancelar</Button>
          <Button variant="contained" onClick={handleUpgrade} disabled={upgrading || !upgradePlanId || upgradePlans.length === 0}>
            {upgrading ? "Gerando..." : "Solicitar upgrade"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

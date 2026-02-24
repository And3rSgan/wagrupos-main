import { useEffect, useState } from "react";
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
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";

type Invoice = {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;
  mpPaymentId?: string | null;
  mpPreferenceId?: string | null;
  company: { id: string; name: string; slug: string; email?: string | null };
  subscription?: {
    plan: { id: string; name: string; slug: string; price: number };
    billingDay: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
};

type Company = { id: string; name: string; slug: string };

export default function AdminInvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("");
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCompanyId) params.set("companyId", filterCompanyId);
      const res = await api.get<Invoice[]>(`/admin-invoices?${params.toString()}`);
      setInvoices(res.data);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Faturas", message: e?.response?.data?.message ?? "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    try {
      const res = await api.get<Company[]>("/companies");
      setCompanies(res.data);
    } catch {
      setCompanies([]);
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [filterStatus, filterCompanyId]);

  async function handleMarkPaid(invoice: Invoice) {
    if (invoice.status === "paid") return;
    setMarkingPaid(invoice.id);
    try {
      await api.patch(`/admin-invoices/${invoice.id}/mark-paid`);
      toast.push({ type: "success", title: "Baixa", message: "Fatura marcada como paga." });
      void loadInvoices();
      setDetailInvoice(null);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Baixa", message: e?.response?.data?.message ?? "Erro ao dar baixa." });
    } finally {
      setMarkingPaid(null);
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
      title="Central de Faturas"
      subtitle="Acompanhe e gerencie faturas de todas as empresas. SuperAdmin pode dar baixa manual."
      actions={
        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => void loadInvoices()} disabled={loading}>
          Atualizar
        </Button>
      }
    >
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <FormControl sx={{ minWidth: 140 }} size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pending">Pendente</MenuItem>
            <MenuItem value="paid">Pago</MenuItem>
            <MenuItem value="overdue">Vencido</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Empresa</InputLabel>
          <Select
            value={filterCompanyId}
            label="Empresa"
            onChange={(e) => setFilterCompanyId(e.target.value)}
          >
            <MenuItem value="">Todas</MenuItem>
            {companies.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fatura</TableCell>
                <TableCell>Empresa</TableCell>
                <TableCell>Plano</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pago em</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} hover>
                  <TableCell>#{inv.id.slice(-8).toUpperCase()}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{inv.company.name}</Typography>
                    {inv.company.email && (
                      <Typography variant="caption" color="text.secondary" display="block">{inv.company.email}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{inv.subscription?.plan?.name ?? "—"}</TableCell>
                  <TableCell>R$ {inv.amount.toFixed(2)}</TableCell>
                  <TableCell>{new Date(inv.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Chip label={inv.status} size="small" color={statusColor[inv.status] ?? "default"} />
                  </TableCell>
                  <TableCell>
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Ver detalhes">
                      <IconButton size="small" onClick={() => setDetailInvoice(inv)}>
                        <VisibilityOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {["pending", "overdue"].includes(inv.status) && (
                      <Tooltip title="Dar baixa manual">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleMarkPaid(inv)}
                          disabled={!!markingPaid}
                        >
                          <CheckCircleOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!invoices.length && !loading && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                    Nenhuma fatura encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!detailInvoice} onClose={() => setDetailInvoice(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalhes da fatura</DialogTitle>
        <DialogContent>
          {detailInvoice && (
            <Box sx={{ "& > div": { mb: 1.5 } }}>
              <Typography variant="body2"><strong>ID:</strong> {detailInvoice.id}</Typography>
              <Typography variant="body2"><strong>Empresa:</strong> {detailInvoice.company.name} ({detailInvoice.company.slug})</Typography>
              {detailInvoice.company.email && (
                <Typography variant="body2"><strong>E-mail empresa:</strong> {detailInvoice.company.email}</Typography>
              )}
              <Typography variant="body2"><strong>Plano:</strong> {detailInvoice.subscription?.plan?.name ?? "—"}</Typography>
              <Typography variant="body2"><strong>Valor:</strong> R$ {detailInvoice.amount.toFixed(2)}</Typography>
              <Typography variant="body2"><strong>Status:</strong> <Chip label={detailInvoice.status} size="small" color={statusColor[detailInvoice.status] ?? "default"} /></Typography>
              <Typography variant="body2"><strong>Vencimento:</strong> {new Date(detailInvoice.dueDate).toLocaleDateString("pt-BR")}</Typography>
              {detailInvoice.paidAt && (
                <Typography variant="body2"><strong>Pago em:</strong> {new Date(detailInvoice.paidAt).toLocaleString("pt-BR")}</Typography>
              )}
              {detailInvoice.mpPaymentId && (
                <Typography variant="body2"><strong>ID pagamento:</strong> {detailInvoice.mpPaymentId}</Typography>
              )}
              {detailInvoice.subscription && (
                <>
                  <Typography variant="body2"><strong>Período atual:</strong> {new Date(detailInvoice.subscription.currentPeriodStart).toLocaleDateString("pt-BR")} — {new Date(detailInvoice.subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}</Typography>
                  <Typography variant="body2"><strong>Criado em:</strong> {new Date(detailInvoice.createdAt).toLocaleString("pt-BR")}</Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {detailInvoice && ["pending", "overdue"].includes(detailInvoice.status) && (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleOutlined />}
              onClick={() => handleMarkPaid(detailInvoice)}
              disabled={!!markingPaid}
            >
              Dar baixa manual
            </Button>
          )}
          <Button onClick={() => setDetailInvoice(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

import { FormEvent, useEffect, useState } from "react";
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
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number;
  limits: { connections?: number; campaigns?: number; users?: number; groups?: number };
  isActive: boolean;
  _count?: { subscriptions: number };
};

export default function PlansPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [connections, setConnections] = useState("1");
  const [campaigns, setCampaigns] = useState("50");
  const [users, setUsers] = useState("5");
  const [groups, setGroups] = useState("200");

  const [editOpen, setEditOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", price: "", connections: "1", campaigns: "50", users: "5", groups: "200", isActive: true });

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Plan[]>("/plans");
      setPlans(res.data);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Planos", message: e?.response?.data?.message ?? "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !price) return;
    setLoading(true);
    try {
      await api.post("/plans", {
        name: name.trim(),
        slug: slug.trim(),
        price: parseFloat(price),
        limits: {
          connections: parseInt(connections) || 1,
          campaigns: parseInt(campaigns) || 50,
          users: parseInt(users) || 5,
          groups: parseInt(groups) || 200,
        },
      });
      toast.push({ type: "success", title: "Planos", message: "Plano criado." });
      setName("");
      setSlug("");
      setPrice("");
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Planos", message: e?.response?.data?.message ?? "Erro ao criar." });
    } finally {
      setLoading(false);
    }
  }

  function openEdit(p: Plan) {
    setEditingPlan(p);
    setEditForm({
      name: p.name,
      slug: p.slug,
      price: String(p.price),
      connections: String(p.limits?.connections ?? 1),
      campaigns: String(p.limits?.campaigns ?? 50),
      users: String(p.limits?.users ?? 5),
      groups: String(p.limits?.groups ?? 200),
      isActive: p.isActive,
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingPlan(null);
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    setLoading(true);
    try {
      await api.put(`/plans/${editingPlan.id}`, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        price: parseFloat(editForm.price),
        limits: {
          connections: parseInt(editForm.connections) || 1,
          campaigns: parseInt(editForm.campaigns) || 50,
          users: parseInt(editForm.users) || 5,
          groups: parseInt(editForm.groups) || 200,
        },
        isActive: editForm.isActive,
      });
      toast.push({ type: "success", title: "Planos", message: "Plano atualizado." });
      closeEdit();
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Planos", message: e?.response?.data?.message ?? "Erro ao atualizar." });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(p: Plan) {
    if (p._count && p._count.subscriptions > 0) {
      toast.push({ type: "warning", title: "Planos", message: "Plano em uso. Desative-o antes de excluir." });
      return;
    }
    if (!confirm(`Excluir o plano "${p.name}"?`)) return;
    try {
      await api.delete(`/plans/${p.id}`);
      toast.push({ type: "success", title: "Planos", message: "Plano excluído." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Planos", message: e?.response?.data?.message ?? "Erro ao excluir." });
    }
  }

  return (
    <PageContainer title="Planos (limites por empresa)" subtitle="Defina planos e limites de uso por empresa.">
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Novo plano
        </Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} size="small" required />
          <TextField label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} size="small" required placeholder="basico" />
          <TextField label="Preço (R$/mês)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} size="small" inputProps={{ step: 0.01, min: 0 }} required />
          <TextField label="Conexões" type="number" value={connections} onChange={(e) => setConnections(e.target.value)} size="small" sx={{ width: 100 }} />
          <TextField label="Campanhas" type="number" value={campaigns} onChange={(e) => setCampaigns(e.target.value)} size="small" sx={{ width: 100 }} />
          <TextField label="Usuários" type="number" value={users} onChange={(e) => setUsers(e.target.value)} size="small" sx={{ width: 100 }} />
          <TextField label="Grupos" type="number" value={groups} onChange={(e) => setGroups(e.target.value)} size="small" sx={{ width: 100 }} />
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            Criar plano
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Plano</TableCell>
                <TableCell>Preço</TableCell>
                <TableCell>Limites</TableCell>
                <TableCell>Assinaturas</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 100 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>R$ {p.price.toFixed(2)}/mês</TableCell>
                  <TableCell>
                    <Box component="span" sx={{ fontSize: 12 }}>
                      Conexões: {p.limits?.connections ?? "—"}, Campanhas: {p.limits?.campaigns ?? "—"}, Usuários: {p.limits?.users ?? "—"}, Grupos: {p.limits?.groups ?? "—"}
                    </Box>
                  </TableCell>
                  <TableCell>{p._count?.subscriptions ?? 0}</TableCell>
                  <TableCell>{p.isActive ? <Chip label="Ativo" size="small" color="success" /> : <Chip label="Inativo" size="small" variant="outlined" />}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(p)} title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(p)} title="Excluir">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={editOpen} onClose={closeEdit} maxWidth="sm" fullWidth>
        <form onSubmit={handleUpdate}>
          <DialogTitle>Editar plano</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Nome" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required fullWidth size="small" />
            <TextField label="Slug" value={editForm.slug} onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))} required fullWidth size="small" />
            <TextField label="Preço (R$/mês)" type="number" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} required fullWidth size="small" inputProps={{ step: 0.01, min: 0 }} />
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField label="Conexões" type="number" value={editForm.connections} onChange={(e) => setEditForm((f) => ({ ...f, connections: e.target.value }))} size="small" sx={{ width: 90 }} />
              <TextField label="Campanhas" type="number" value={editForm.campaigns} onChange={(e) => setEditForm((f) => ({ ...f, campaigns: e.target.value }))} size="small" sx={{ width: 90 }} />
              <TextField label="Usuários" type="number" value={editForm.users} onChange={(e) => setEditForm((f) => ({ ...f, users: e.target.value }))} size="small" sx={{ width: 90 }} />
              <TextField label="Grupos" type="number" value={editForm.groups} onChange={(e) => setEditForm((f) => ({ ...f, groups: e.target.value }))} size="small" sx={{ width: 90 }} />
            </Box>
            <FormControlLabel
              control={<Checkbox checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} />}
              label="Plano ativo"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeEdit}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary" disabled={loading}>
              Salvar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import AssignmentTurnedInOutlined from "@mui/icons-material/AssignmentTurnedInOutlined";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

type Company = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  email?: string | null;
  subscription?: {
    planId: string;
    billingDay: number;
    currentPeriodEnd: string;
    plan: { id: string; name: string; price: number };
  } | null;
  _count?: { users: number };
};

type Plan = { id: string; name: string; slug: string; price: number };

type Session = {
  id: string;
  name: string;
  status: string;
  waPushName?: string | null;
  waPhone?: string | null;
  waAvatarUrl?: string | null;
  lastConnectedAt?: string | null;
  isDefault?: boolean;
};

type CompanyUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  users: CompanyUser[];
  whatsappSessions: Session[];
};

export default function CompaniesPage() {
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [assignPlanId, setAssignPlanId] = useState<Record<string, string>>({});
  const [detailCompany, setDetailCompany] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "USER" });

  async function load() {
    setLoading(true);
    try {
      const [compRes, planRes] = await Promise.all([
        api.get<Company[]>("/companies"),
        api.get<Plan[]>("/plans"),
      ]);
      setCompanies(compRes.data);
      setPlans(planRes.data);
      const initial: Record<string, string> = {};
      compRes.data.forEach((c) => {
        if (c.subscription?.plan?.id) initial[c.id] = c.subscription.plan.id;
      });
      setAssignPlanId(initial);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Empresas", message: e?.response?.data?.message ?? "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const s =
        slug.trim() ||
        name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-") ||
        "empresa";
      await api.post("/companies", { name: name.trim(), slug: s });
      toast.push({ type: "success", title: "Empresas", message: "Empresa criada." });
      setName("");
      setSlug("");
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Empresas", message: e?.response?.data?.message ?? "Erro ao criar." });
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignPlan(companyId: string, planId: string) {
    try {
      await api.put(`/subscriptions/company/${companyId}`, { planId });
      toast.push({ type: "success", title: "Assinatura", message: "Plano atribuído." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Assinatura", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  async function handleChangeCycle(companyId: string, billingDay: number) {
    try {
      await api.put(`/subscriptions/company/${companyId}/cycle`, { billingDay });
      toast.push({ type: "success", title: "Ciclo", message: "Ciclo atualizado." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Ciclo", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  async function handleBaixa(companyId: string) {
    try {
      await api.post(`/subscriptions/company/${companyId}/baixa`);
      toast.push({ type: "success", title: "Baixa", message: "Baixa registrada. Período avançado." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Baixa", message: e?.response?.data?.message ?? "Erro." });
    }
  }

  async function openDetail(companyId: string) {
    setDetailLoading(true);
    setDetailCompany(null);
    try {
      const res = await api.get<CompanyDetail>(`/companies/${companyId}`);
      setDetailCompany(res.data);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Empresa", message: e?.response?.data?.message ?? "Erro ao carregar detalhes." });
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDisconnect(sessionId: string) {
    try {
      await api.post(`/companies/sessions/${sessionId}/disconnect`);
      toast.push({ type: "success", title: "Conexão", message: "Sessão desconectada." });
      if (detailCompany) {
        const updated = await api.get<CompanyDetail>(`/companies/${detailCompany.id}`);
        setDetailCompany(updated.data);
      }
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Conexão", message: e?.response?.data?.message ?? "Erro ao desconectar." });
    }
  }

  function openEditUser(u: CompanyUser) {
    setEditingUser(u);
    setEditForm({ name: u.name ?? "", email: u.email, password: "", role: u.role });
  }

  async function handleDeactivate(companyId: string, companyName: string) {
    if (!confirm(`Desativar a empresa "${companyName}"? Usuários não poderão acessar o sistema.`)) return;
    try {
      await api.post(`/companies/${companyId}/deactivate`);
      toast.push({ type: "success", title: "Empresa", message: "Empresa desativada." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Empresa", message: e?.response?.data?.message ?? "Erro ao desativar." });
    }
  }

  async function handleActivate(companyId: string) {
    try {
      await api.post(`/companies/${companyId}/activate`);
      toast.push({ type: "success", title: "Empresa", message: "Empresa reativada." });
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Empresa", message: e?.response?.data?.message ?? "Erro ao reativar." });
    }
  }

  async function handleDelete(companyId: string, companyName: string) {
    if (!confirm(`Excluir permanentemente a empresa "${companyName}"?\n\nIsso removerá usuários, assinaturas e dados associados. Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/companies/${companyId}`);
      toast.push({ type: "success", title: "Empresa", message: "Empresa excluída." });
      setDetailCompany((prev) => (prev?.id === companyId ? null : prev));
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Empresa", message: e?.response?.data?.message ?? "Erro ao excluir." });
    }
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const payload: { name?: string; email?: string; password?: string; role?: string } = {
        name: editForm.name.trim() || undefined,
        email: editForm.email.trim() || undefined,
        role: editForm.role,
      };
      if (editForm.password) payload.password = editForm.password;
      await api.put(`/admin/users/${editingUser.id}`, payload);
      toast.push({ type: "success", title: "Usuário", message: "Dados atualizados." });
      setEditingUser(null);
      if (detailCompany) {
        const updated = await api.get<CompanyDetail>(`/companies/${detailCompany.id}`);
        setDetailCompany(updated.data);
      }
      await load();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Usuário", message: e?.response?.data?.message ?? "Erro ao atualizar." });
    }
  }

  return (
    <PageContainer title="Empresas (SaaS)" subtitle="Gerencie empresas e assinaturas.">
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Nova empresa
        </Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} size="small" required />
          <TextField label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} size="small" placeholder="auto" />
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            Criar
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }}></TableCell>
                <TableCell>Empresa</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Usuários</TableCell>
                <TableCell>Plano atual</TableCell>
                <TableCell>Ciclo (venc.)</TableCell>
                <TableCell>Próx. venc.</TableCell>
                <TableCell>Dar baixa</TableCell>
                <TableCell>Atribuir plano</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Tooltip title="Ver detalhes (usuários e conexões)">
                      <IconButton size="small" onClick={() => openDetail(c.id)} sx={{ p: 0.5 }}>
                        <VisibilityOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.slug}</TableCell>
                  <TableCell>{c._count?.users ?? 0}</TableCell>
                  <TableCell>
                    {c.subscription?.plan ? (
                      <Chip label={`${c.subscription.plan.name} — R$ ${c.subscription.plan.price.toFixed(2)}/mês`} size="small" color="primary" variant="outlined" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">Sem plano</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.subscription ? (
                      <FormControl size="small" sx={{ minWidth: 70 }}>
                        <Select
                          value={c.subscription.billingDay ?? 1}
                          onChange={(e) => handleChangeCycle(c.id, Number(e.target.value))}
                          sx={{ fontSize: "0.8rem", py: 0.25 }}
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <MenuItem key={d} value={d}>Dia {d}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {c.subscription ? (
                      <Typography variant="body2">
                        {new Date(c.subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {c.subscription ? (
                      <Tooltip title="Dar baixa (marca fatura como paga e avança período)">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleBaixa(c.id)}
                          sx={{ p: 0.5 }}
                        >
                          <AssignmentTurnedInOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Plano</InputLabel>
                      <Select
                        value={assignPlanId[c.id] ?? c.subscription?.plan?.id ?? ""}
                        label="Plano"
                        onChange={(e) => {
                          const pid = e.target.value;
                          setAssignPlanId((prev) => ({ ...prev, [c.id]: pid }));
                          if (pid) handleAssignPlan(c.id, pid);
                        }}
                      >
                        <MenuItem value="">—</MenuItem>
                        {plans.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.name} - R$ {p.price.toFixed(2)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.isActive !== false ? "Ativa" : "Inativa"}
                      size="small"
                      color={c.isActive !== false ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {c.isActive !== false ? (
                        <Tooltip title="Desativar empresa">
                          <Button size="small" variant="outlined" color="warning" onClick={() => handleDeactivate(c.id, c.name)}>
                            Desativar
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Reativar empresa">
                          <Button size="small" variant="outlined" color="success" onClick={() => handleActivate(c.id)}>
                            Ativar
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip title="Excluir empresa permanentemente">
                        <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(c.id, c.name)}>
                          Excluir
                        </Button>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal de detalhes: usuários e conexões */}
      <Dialog open={!!detailCompany || detailLoading} onClose={() => !detailLoading && setDetailCompany(null)} maxWidth="md" fullWidth>
        <DialogTitle>{detailCompany ? detailCompany.name : "Detalhes"}</DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Typography color="text.secondary">Carregando...</Typography>
          ) : detailCompany ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Usuários (dados de login)</Typography>
                {detailCompany.users.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">Nenhum usuário.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>E-mail</TableCell>
                        <TableCell>Nome</TableCell>
                        <TableCell>Perfil</TableCell>
                        <TableCell align="right"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailCompany.users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.name || "—"}</TableCell>
                          <TableCell><Chip label={u.role} size="small" variant="outlined" /></TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" onClick={() => openEditUser(u)}>
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Conexões WhatsApp</Typography>
                {!detailCompany.whatsappSessions?.length ? (
                  <Typography variant="body2" color="text.secondary">Nenhuma conexão.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sessão</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right"></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(detailCompany.whatsappSessions ?? []).map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.name} {s.waPushName ? `(${s.waPushName})` : ""}</TableCell>
                            <TableCell>
                              <Chip
                                label={s.status === "connected" ? "Conectado" : s.status}
                                size="small"
                                color={s.status === "connected" ? "success" : "default"}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              {s.status === "connected" && (
                                <Button size="small" color="error" variant="outlined" onClick={() => handleDisconnect(s.id)}>
                                  Desconectar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailCompany(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal editar usuário */}
      <Dialog open={!!editingUser} onClose={() => setEditingUser(null)} maxWidth="xs" fullWidth>
        <form onSubmit={handleEditUser}>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <TextField
                fullWidth
                label="Nome"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              <TextField
                fullWidth
                label="E-mail"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Nova senha (deixe em branco para manter)"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              />
              <FormControl fullWidth>
                <InputLabel>Perfil</InputLabel>
                <Select
                  value={editForm.role}
                  label="Perfil"
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <MenuItem value="USER">USER</MenuItem>
                  <MenuItem value="ADMIN">ADMIN</MenuItem>
                  <MenuItem value="SUPERVISOR">SUPERVISOR</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </PageContainer>
  );
}

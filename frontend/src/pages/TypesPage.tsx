import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../toast/ToastContext";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Typography from "@mui/material/Typography";

type TemplateType = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
};

export default function TypesPage() {
  const toast = useToast();
  const [types, setTypes] = useState<TemplateType[]>([]);
  const [loading, setLoading] = useState(false);

  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<TemplateType[]>("/template-types");
      setTypes(res.data);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Tipos", message: e?.response?.data?.message ?? "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setSlug("");
    setLabel("");
    setEditingId(null);
  }

  function startEdit(t: TemplateType) {
    setSlug(t.slug);
    setLabel(t.label);
    setEditingId(t.id);
  }

  function slugFromLabel() {
    const s = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_");
    setSlug(s || slug);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !label.trim()) {
      toast.push({ type: "warning", title: "Tipos", message: "Preencha slug e nome." });
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/template-types/${editingId}`, { slug: slug.trim(), label: label.trim() });
        toast.push({ type: "success", title: "Tipos", message: "Tipo atualizado." });
      } else {
        await api.post("/template-types", { slug: slug.trim(), label: label.trim() });
        toast.push({ type: "success", title: "Tipos", message: "Tipo criado." });
      }
      await load();
      resetForm();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Tipos", message: e?.response?.data?.message ?? "Erro ao salvar." });
    } finally {
      setLoading(false);
    }
  }

  async function removeType(t: TemplateType) {
    if (!confirm(`Remover tipo "${t.label}"? Templates que usam este tipo passarão para Personalizado.`)) return;
    try {
      await api.delete(`/template-types/${t.id}`);
      setTypes((prev) => prev.filter((x) => x.id !== t.id));
      toast.push({ type: "success", title: "Tipos", message: "Tipo removido." });
      if (editingId === t.id) resetForm();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Tipos", message: e?.response?.data?.message ?? "Erro ao remover." });
    }
  }

  return (
    <PageContainer
      title="Tipos de template"
      subtitle="Categorize seus templates: Oferta Relâmpago, Cupom, Frete Grátis, Personalizado, etc."
      actions={<Button variant="outlined" onClick={load} disabled={loading}>Atualizar</Button>}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        <Paper sx={{ p: 2, flex: "1 1 360px", maxWidth: 420 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            {editingId ? "Editar tipo" : "Novo tipo"}
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Nome exibido"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => !editingId && slugFromLabel()}
              placeholder="Ex: Oferta Relâmpago"
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Slug (identificador)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Ex: oferta_relampago"
              helperText="Apenas letras minúsculas, números e _"
              required
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                color="primary"
              >
                {loading ? "Salvando..." : editingId ? "Atualizar" : "Criar tipo"}
              </Button>
              {editingId && (
                <Button variant="outlined" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </Box>
          </form>
        </Paper>

        <Paper sx={{ p: 2, flex: "1 1 360px" }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Meus tipos
          </Typography>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} selected={editingId === t.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{t.label}</TableCell>
                    <TableCell sx={{ color: "#6b7280" }}>{t.slug}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => startEdit(t)} title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => removeType(t)} title="Remover">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!types.length && (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ color: "#6b7280" }}>
                      Nenhum tipo. Serão criados os padrão ao acessar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </PageContainer>
  );
}

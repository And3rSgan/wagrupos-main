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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

type Template = {
  id: string;
  name: string;
  templateType: string;
  body: string;
  cta?: string | null;
};

type TemplateTypeItem = { id: string; slug: string; label: string; sortOrder: number };

const PLACEHOLDER_HINT = "Placeholders: {titulo}, {preco}, {precoAntigo}, {desconto}, {cupom}, {link}, {loja}, {categoria} | Spintax: {opção1|opção2}";

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [types, setTypes] = useState<TemplateTypeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [tplRes, typRes] = await Promise.all([
        api.get<{ builtin: unknown[]; custom: Template[] }>("/message-templates"),
        api.get<TemplateTypeItem[]>("/template-types"),
      ]);
      setTemplates(tplRes.data.custom);
      setTypes(typRes.data);
    } catch (e: any) {
      toast.push({ type: "danger", title: "Templates", message: e?.response?.data?.message ?? "Erro ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const typeLabel = (slug: string) => types.find((t) => t.slug === slug)?.label ?? slug;
  const defaultType = types[0]?.slug ?? "custom";

  function resetForm() {
    setName("");
    setTemplateType(defaultType);
    setBody("");
    setCta("");
    setEditingId(null);
  }

  function startEdit(t: Template) {
    setName(t.name);
    setTemplateType(t.templateType);
    setBody(t.body);
    setCta(t.cta ?? "");
    setEditingId(t.id);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      toast.push({ type: "warning", title: "Templates", message: "Preencha nome e conteúdo." });
      return;
    }
    setLoading(true);
    try {
      const typeValue = templateType || defaultType;
      if (editingId) {
        await api.put(`/message-templates/${editingId}`, { name, templateType: typeValue, body, cta: cta || undefined });
        toast.push({ type: "success", title: "Templates", message: "Template atualizado." });
      } else {
        await api.post("/message-templates", { name, templateType: typeValue, body, cta: cta || undefined });
        toast.push({ type: "success", title: "Templates", message: "Template criado." });
      }
      await load();
      resetForm();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Templates", message: e?.response?.data?.message ?? "Erro ao salvar." });
    } finally {
      setLoading(false);
    }
  }

  async function removeTemplate(t: Template) {
    if (!confirm(`Remover template "${t.name}"?`)) return;
    try {
      await api.delete(`/message-templates/${t.id}`);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast.push({ type: "success", title: "Templates", message: "Template removido." });
      if (editingId === t.id) resetForm();
    } catch (e: any) {
      toast.push({ type: "danger", title: "Templates", message: e?.response?.data?.message ?? "Erro ao remover." });
    }
  }

  return (
    <PageContainer
      title="Templates de mensagem"
      subtitle="Crie templates reutilizáveis para campanhas. Use placeholders e spintax."
      actions={<Button variant="outlined" onClick={load} disabled={loading}>Atualizar</Button>}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        <Paper sx={{ p: 2, flex: "1 1 400px", maxWidth: 500 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{editingId ? "Editar template" : "Novo template"}</Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Black Friday 2025"
              required
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Tipo</InputLabel>
              <Select value={templateType || defaultType} label="Tipo" onChange={(e) => setTemplateType(e.target.value)}>
                {types.map((t) => (
                  <MenuItem key={t.id} value={t.slug}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Conteúdo do template"
              multiline
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={PLACEHOLDER_HINT}
              required
              helperText={PLACEHOLDER_HINT}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="CTA (opcional)"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Ex: Acesse agora!"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                color="primary"
              >
                {loading ? "Salvando..." : editingId ? "Atualizar" : "Criar template"}
              </Button>
              {editingId && (
                <Button variant="outlined" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </Box>
          </form>
        </Paper>

        <Paper sx={{ p: 2, flex: "1 1 400px" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Meus templates</Typography>
          <TableContainer sx={{ maxHeight: 450 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right" sx={{ width: 120 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id} selected={editingId === t.id}>
                    <TableCell>
                      <Box sx={{ fontWeight: 600 }}>{t.name}</Box>
                      <Box sx={{ color: "#6b7280", fontSize: 12, mt: 0.5 }}>{t.body.length > 60 ? `${t.body.slice(0, 60)}…` : t.body}</Box>
                    </TableCell>
                    <TableCell>{typeLabel(t.templateType)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => startEdit(t)} title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => removeTemplate(t)} title="Remover">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!templates.length && (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ color: "#6b7280" }}>
                      Nenhum template criado. Crie um ao lado.
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

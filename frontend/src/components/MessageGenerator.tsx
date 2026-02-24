import { useEffect, useState } from "react";
import { api } from "../api";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { WhatsAppPreview } from "./WhatsAppPreview";

type Product = { id: string; title: string; price: string; oldPrice?: string | null; discountPercent?: number | null; coupon?: string | null; link?: string | null; store?: string | null; category?: string | null; status?: string };
type Template = { name: string; templateType: string; body: string };

interface MessageGeneratorProps {
  value: string;
  onChange: (msg: string) => void;
  productId?: string;
  onProductChange?: (id: string) => void;
  templateId?: string;
  onTemplateChange?: (id: string) => void;
}

export function MessageGenerator({ value, onChange, productId, onProductChange, templateId, onTemplateChange }: MessageGeneratorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<{ builtin: Template[]; custom: { id: string; name: string; body: string }[] }>({ builtin: [], custom: [] });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateBody, setTemplateBody] = useState("");
  const [preview, setPreview] = useState("");

  async function load() {
    try {
      const [prodRes, tplRes] = await Promise.all([
        api.get<Product[]>("/products"),
        api.get<{ builtin: Template[]; custom: { id: string; name: string; templateType: string; body: string }[] }>("/message-templates"),
      ]);
      setProducts(prodRes.data);
      setTemplates({ builtin: tplRes.data.builtin, custom: tplRes.data.custom });
    } catch {
      //
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate() {
    if (!templateBody.trim()) return;
    try {
      const res = await api.post<{ message: string }>("/message-templates/generate", {
        templateBody,
        productId: productId || undefined,
        seed: Math.floor(Math.random() * 1e6),
      });
      onChange(res.data.message);
      setPreview(res.data.message);
    } catch {
      //
    }
  }

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "#f9fafb"),
        color: "text.primary",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }} color="text.primary">
        Gerador de mensagem
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
        Use templates prontos, selecione um produto e variantes com spintax{" "}
        <Box
          component="code"
          sx={{
            background: (theme) => (theme.palette.mode === "dark" ? "grey.800" : "#e5e7eb"),
            color: "text.primary",
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
          }}
        >
          {"{opção1|opção2}"}
        </Box>{" "}
        para não repetir igual em todos os grupos.
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={selectedTemplateId}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedTemplateId(v);
              onTemplateChange?.(v.startsWith("builtin_") ? "" : v);
              if (v.startsWith("builtin_")) {
                const idx = parseInt(v.split("_")[1], 10);
                setTemplateBody(templates.builtin[idx]?.body || "");
              } else {
                const t = templates.custom.find((x) => x.id === v);
                setTemplateBody(t?.body || "");
              }
            }}
          >
            <MenuItem value="">
              <em>Selecione</em>
            </MenuItem>
            {templates.builtin.map((t, i) => (
              <MenuItem key={i} value={`builtin_${i}`}>
                {t.name}
              </MenuItem>
            ))}
            {templates.custom.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} (custom)
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {onProductChange && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Produto</InputLabel>
            <Select
              label="Produto"
              value={productId || ""}
              onChange={(e) => onProductChange(e.target.value)}
            >
              <MenuItem value="">
                <em>Nenhum</em>
              </MenuItem>
              {products.filter((p) => !p.status || p.status === "active").map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.title} - {p.price}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button variant="outlined" size="small" onClick={generate} disabled={!templateBody.trim()}>
          Gerar mensagem
        </Button>
      </Box>
      <TextField
        fullWidth
        label="Template (placeholders: titulo, preco, precoAntigo, desconto, cupom, link, loja, categoria)"
        multiline
        rows={3}
        value={templateBody}
        onChange={(e) => setTemplateBody(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
      />
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
          Preview (como vai aparecer no WhatsApp):
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            overflow: "hidden",
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.800" : "#fafafa"),
          }}
        >
          <WhatsAppPreview message={value} />
        </Paper>
      </Box>
    </Paper>
  );
}

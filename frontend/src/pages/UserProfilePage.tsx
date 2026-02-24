import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../toast/ToastContext";
import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";

export default function UserProfilePage() {
  const { refreshMe } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function loadMe() {
    setLoading(true);
    try {
      const res = await api.get("/auth/me");
      setName(res.data?.name || "");
      setEmail(res.data?.email || "");
    } catch (e: any) {
      toast.push({
        type: "danger",
        title: "Perfil",
        message: e?.response?.data?.message ?? "Erro ao carregar dados do perfil.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password && password !== confirmPassword) {
      toast.push({
        type: "warning",
        title: "Perfil",
        message: "A confirmaçao da senha não confere.",
      });
      return;
    }

    setSaving(true);
    try {
      await api.put("/auth/me", {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        password: password || undefined,
      });
      setPassword("");
      setConfirmPassword("");
      await refreshMe();
      toast.push({ type: "success", title: "Perfil", message: "Dados atualizados com sucesso." });
    } catch (e: any) {
      toast.push({
        type: "danger",
        title: "Perfil",
        message: e?.response?.data?.message ?? "Erro ao salvar perfil.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer title="Minha conta" subtitle="Atualize seu perfil e altere sua senha.">
      <Paper sx={{ p: 2, maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading || saving}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || saving}
            sx={{ mb: 2 }}
          />
          <Box sx={{ my: 2, borderTop: 1, borderColor: "divider" }} />
          <h6 style={{ marginBottom: 16 }}>Trocar senha</h6>
          <TextField
            fullWidth
            label="Nova senha"
            type="password"
            inputProps={{ minLength: 6 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || saving}
            placeholder="Deixe em branco para manter a atual"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Confirmar nova senha"
            type="password"
            inputProps={{ minLength: 6 }}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || saving}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            type="submit"
            disabled={loading || saving}
            color="primary"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </Paper>
    </PageContainer>
  );
}

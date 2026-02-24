import { PageContainer } from "../components/PageContainer";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export default function HelpPage() {
  return (
    <PageContainer title="Ajuda" subtitle="Passo a passo e erros comuns.">
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Passo a passo</Typography>
        <ol style={{ color: "#6b7280" }}>
          <li>
            Faça login no painel em <code>/login</code>.
          </li>
          <li>
            Vá em <b>Conexão WhatsApp</b> → gere o QR e leia com seu WhatsApp.
          </li>
          <li>
            Vá em <b>Disparo em grupos</b> → sincronize grupos.
          </li>
          <li>
            Vá em <b>Campanhas</b> → crie (foto/texto/link) e envie.
          </li>
        </ol>

        <Box sx={{ my: 2, borderTop: 1, borderColor: "divider" }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Erros comuns</Typography>
        <ul style={{ color: "#6b7280" }}>
          <li>
            <b>401</b>: token expirou ou você não está logado. Faça login novamente.
          </li>
          <li>
            <b>Não aparece QR</b>: aguarde alguns segundos após clicar em "Gerar QR" para o
            o backend gerar o código QR (conexão via Baileys).
          </li>
          <li>
            <b>QR expirou</b>: clique em <b>Reiniciar</b> e depois em <b>Gerar QR</b> novamente.
          </li>
          <li>
            <b>Grupos não aparecem</b>: certifique-se de que o WhatsApp está conectado
            antes de sincronizar os grupos.
          </li>
        </ul>
      </Paper>
    </PageContainer>
  );
}

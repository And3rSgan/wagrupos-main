import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

const TERM_TEXT =
  "Ao utilizar os disparos (campanhas ou envio direto para grupos), você concorda que o envio é realizado por meio de API de terceiros. " +
  "O uso em massa pode resultar em restrições ou bloqueio da sua conta pelo WhatsApp. " +
  "Ao clicar em \"Concordo\", esta aceitação ficará registrada nas configurações da empresa.";

type ApiTermsDialogProps = {
  open: boolean;
  onClose: () => void;
  onAccept: () => Promise<void>;
  accepting?: boolean;
};

export function ApiTermsDialog({ open, onClose, onAccept, accepting }: ApiTermsDialogProps) {
  async function handleAccept() {
    await onAccept();
    onClose();
  }

  return (
    <Dialog open={open} onClose={accepting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Termo de uso — API de terceiros</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "text.primary" }}>{TERM_TEXT}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={accepting}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleAccept} disabled={accepting}>
          {accepting ? "Salvando..." : "Concordo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

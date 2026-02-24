import { useEffect, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import LinearProgress from "@mui/material/LinearProgress";
import { ToastItem } from "./ToastContext";

const severityMap = {
  success: "success" as const,
  danger: "error" as const,
  warning: "warning" as const,
  info: "info" as const,
};

const AUTO_HIDE = 4500;

const progressColorMap = {
  success: "#2e7d32",
  danger: "#d32f2f",
  warning: "#ed6c02",
  info: "#0288d1",
};

export function ToastHost({ items, onRemove }: { items: ToastItem[]; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (items.length > 0) {
      const first = items[0];
      if (!current || current.id !== first.id) {
        setCurrent(first);
        setOpen(true);
        setProgress(100);
      }
    } else {
      setCurrent(null);
      setOpen(false);
    }
  }, [items, current]);

  useEffect(() => {
    if (!open || !current) return;

    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_HIDE) * 100);
      setProgress(remaining);
    }, 50);

    return () => clearInterval(timer);
  }, [open, current]);

  function handleClose() {
    if (current) {
      onRemove(current.id);
    }
    setOpen(false);
    setCurrent(null);
  }

  if (!current) return null;

  const text = current.title ? `${current.title}: ${current.message}` : current.message;
  const severity = severityMap[current.type];
  const progressColor = progressColorMap[current.type];

  return (
    <Snackbar
      open={open}
      autoHideDuration={AUTO_HIDE}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ top: 16, right: 16 }}
    >
      <Alert
        severity={severity}
        variant="standard"
        action={
          <IconButton size="small" aria-label="fechar" onClick={handleClose} sx={{ color: "rgba(0,0,0,0.54)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          backgroundColor: "#fff",
          color: "rgba(0,0,0,0.87)",
          boxShadow: "0px 4px 12px rgba(0,0,0,0.15)",
          "& .MuiAlert-icon": {
            color: progressColor,
          },
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: "100%", paddingRight: 8 }}>
          <div>{text}</div>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              mt: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(0,0,0,0.08)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: progressColor,
              },
            }}
          />
        </div>
      </Alert>
    </Snackbar>
  );
}

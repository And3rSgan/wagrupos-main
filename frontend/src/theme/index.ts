import { createTheme, PaletteMode } from "@mui/material/styles";

export function getMuiTheme(mode: PaletteMode) {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#60a5fa" : "#2563eb",
        light: isDark ? "#93c5fd" : "#3b82f6",
        dark: isDark ? "#3b82f6" : "#1d4ed8",
        contrastText: "#fff",
      },
      secondary: {
        main: isDark ? "#64748b" : "#475569",
        light: isDark ? "#94a3b8" : "#64748b",
      },
      background: {
        default: isDark ? "#0f172a" : "#f1f5f9",
        paper: isDark ? "#1e293b" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f1f5f9" : "#0f172a",
        secondary: isDark ? "#94a3b8" : "#64748b",
      },
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none" },
          contained: { borderRadius: 8 },
          outlined: { borderRadius: 8 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundImage: "none",
            ...(isDark && { border: "1px solid rgba(255,255,255,0.08)" }),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundImage: "none",
            ...(isDark && { border: "1px solid rgba(255,255,255,0.08)" }),
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 6 } },
      },
      MuiTextField: {
        defaultProps: { variant: "outlined" as const, size: "small" as const },
      },
    },
  });
}

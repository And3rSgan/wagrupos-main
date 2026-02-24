import { useMemo } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useTheme } from "./ThemeContext";
import { getMuiTheme } from "./index";

export function MuiThemeWrapper({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme();
  const theme = useMemo(() => getMuiTheme(mode), [mode]);
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

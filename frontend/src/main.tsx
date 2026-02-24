/**
 * WhatsApp Group Sender SaaS - Frontend
 * Site: plwdesign.online
 * Autor: Santos PLW / Alex
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/zest.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./toast/ToastContext";
import { BrandingProvider } from "./branding/BrandingContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { MuiThemeWrapper } from "./theme/MuiThemeWrapper";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <MuiThemeWrapper>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <BrandingProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </BrandingProvider>
        </BrowserRouter>
      </MuiThemeWrapper>
    </ThemeProvider>
  </React.StrictMode>
);


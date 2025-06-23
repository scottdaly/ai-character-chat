// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CreditProvider } from "./contexts/CreditContext";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CreditProvider>
        <DataProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </DataProvider>
      </CreditProvider>
    </AuthProvider>
  </React.StrictMode>
);

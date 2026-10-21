import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { SettingsProvider } from "./settings";
import { ThemeProvider } from "./theme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

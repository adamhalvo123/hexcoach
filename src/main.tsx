import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./state/store";
import { isDesktop } from "./lib/env";
import "./styles.css";

if (!isDesktop()) {
  document.documentElement.classList.add("web-preview");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);

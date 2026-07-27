import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/styles/global.css";
import {
  applyThemeToDocument,
  resolveTheme,
  useThemeStore,
} from "@/stores/useThemeStore";

applyThemeToDocument(resolveTheme(useThemeStore.getState().preference));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

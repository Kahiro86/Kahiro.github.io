import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "./ui/toast.jsx";
import { App } from "./App.jsx";
import { initSync } from "./sync/sync.js";
import "./main.css";

// Safe to call unconditionally: with no project configured it registers a
// listener, sets the status to "off" and never touches the network or
// downloads the Supabase SDK.
initSync();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

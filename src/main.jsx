import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "@/context/AppProvider.jsx";
import { AuthProvider } from "@/context/AuthProvider.jsx";
import App from "@/App";
import "@/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </StrictMode>,
);

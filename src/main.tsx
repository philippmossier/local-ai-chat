import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Toaster } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { lang, tr } from "./lib/lang";
import { initTheme } from "./lib/theme";
import "./styles.css";

document.documentElement.lang = lang;
document.title = tr(
  "Local AI Chat - private AI on your own computer",
  "Lokaler KI-Chat - private KI auf Ihrem eigenen Computer",
);

// Light, dark or follow the system (the menu in the top bar). The theme tokens do the rest.
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <Toaster>
        <App />
      </Toaster>
    </TooltipProvider>
  </StrictMode>,
);

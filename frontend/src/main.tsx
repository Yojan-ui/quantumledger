import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AetherDashboard } from "./AetherDashboard";
import { feed } from "./state/feed";
import "./state/kem";

feed.connect();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AetherDashboard />
  </StrictMode>,
);

import { createRoot } from "react-dom/client";
import "./lib/authSessionClockSkew";
import App from "./App.tsx";
import "./index.css";
import { setupAutoSync } from "./lib/offlineDb";
import ErrorBoundary from "./components/ErrorBoundary";

setupAutoSync();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

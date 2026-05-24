import { createRoot } from "react-dom/client";
// Clock skew normalization is handled inside AuthProvider's useEffect.
// Do NOT import authSessionClockSkew here — its module-level side effect
// was removed to prevent storage event feedback loops.
import App from "./App.tsx";
import "./index.css";
import { setupAutoSync } from "./lib/offlineDb";
import { installGlobalErrorHandlers } from "./lib/errorReporter";
import ErrorBoundary from "./components/ErrorBoundary";

setupAutoSync();
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

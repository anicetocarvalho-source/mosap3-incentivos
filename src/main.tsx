import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAutoSync } from "./lib/offlineDb";

setupAutoSync();

createRoot(document.getElementById("root")!).render(<App />);

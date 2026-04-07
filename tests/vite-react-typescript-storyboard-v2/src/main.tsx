import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "reactflow/dist/style.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./components/App.tsx";

import "reactflow/dist/style.css";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Theme appearance="light">
      <App />
    </Theme>
  </QueryClientProvider>,
);

import { BrowserRouter } from "react-router-dom";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgChartsEnterpriseModule } from "ag-charts-enterprise";
import { ModuleRegistry } from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";

import { createRoot } from "react-dom/client";
import { client as heyApiClient } from "./api/client.gen";

import App from "./App";

import "./index.css";
import "@radix-ui/themes/styles.css";

if (typeof window !== "undefined") {
  const current = heyApiClient.getConfig();
  if (current.baseUrl !== window.location.origin) {
    heyApiClient.setConfig({ ...current, baseUrl: window.location.origin });
  }
}

ModuleRegistry.registerModules([
  AllEnterpriseModule.with(AgChartsEnterpriseModule),
]);

const queryClient = new QueryClient();

const root = createRoot(document.getElementById("root") as Element);

root.render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Theme appearance="dark">
        <App />
      </Theme>
    </BrowserRouter>
  </QueryClientProvider>,
);

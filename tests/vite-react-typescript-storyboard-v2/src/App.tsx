import { ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "jotai/react";

import { useIdentity } from "./identity.ts";

import DesignPage from "./pages/DesignPage";
import HomePage from "./pages/HomePage";
import { getDesignId } from "./utils/getDesignId";

const queryClient = new QueryClient();

function App() {
  const identity = useIdentity();
  if (!identity) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Theme appearance="light">
        <BrowserRouter>
          <ResetJotaiOnScopeChange>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/design/:designId" element={<DesignPage />} />
              <Route path="*" element={<Navigate to="/" />} />\
            </Routes>
          </ResetJotaiOnScopeChange>
        </BrowserRouter>
      </Theme>
    </QueryClientProvider>
  );
}

function ResetJotaiOnScopeChange({ children }: { children: ReactNode }) {
  const location = useLocation();

  const designId = getDesignId(location.pathname);

  return <Provider key={designId}>{children}</Provider>;
}

export default App;

import { Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Flex, Tabs } from "@radix-ui/themes";
import { colorSchemeDark, themeQuartz } from "ag-grid-community";

import ErrorBoundary from "./components/ErrorBoundary";
import AccountTable from "./components/tables/AccountTable";
import PriceTable from "./components/tables/PriceTable";
import QuotaTable from "./components/tables/QuotaTable";
import SkeletonTable from "./components/tables/SkeletonTable";
import SubscriptionTable from "./components/tables/SubscriptionTable";
import UpgradeTable from "./components/tables/UpgradeTable";
import UsageEventTable from "./components/tables/UsageEventTable";
import UsageTable from "./components/tables/UsageTable";

import "./App.css";

const theme = themeQuartz.withPart(colorSchemeDark).withParams({
  fontFamily: "var(--default-font-family)",
  fontSize: 13,
  backgroundColor: "var(--gray-1)",
  foregroundColor: "var(--gray-12)",
  headerBackgroundColor: "var(--gray-2)",
  headerTextColor: "var(--gray-11)",
  oddRowBackgroundColor: "var(--gray-2)",
  rowHoverColor: "var(--gray-3)",
  borderColor: "transparent",
  accentColor: "var(--accent-9)",
  borderRadius: 0,
  headerColumnResizeHandleColor: "var(--accent-9)",
  rowBorder: { width: 1, color: "var(--gray-4)" },
  columnBorder: false,
  wrapperBorder: false,
});

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "accounts";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <Flex className="app" direction="column">
      <Tabs.Root
        value={tab}
        onValueChange={handleTabChange}
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="accounts">Accounts</Tabs.Trigger>
          <Tabs.Trigger value="subscriptions">Subscriptions</Tabs.Trigger>
          <Tabs.Trigger value="prices">Prices</Tabs.Trigger>
          <Tabs.Trigger value="upgrades">Upgrades</Tabs.Trigger>
          <Tabs.Trigger value="quotas">Quotas</Tabs.Trigger>
          <Tabs.Trigger value="usage-events">Usage Events</Tabs.Trigger>
          <Tabs.Trigger value="usages">Usages</Tabs.Trigger>
        </Tabs.List>

        <Box
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Tabs.Content value="accounts" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <AccountTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>

          <Tabs.Content value="subscriptions" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <SubscriptionTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>

          <Tabs.Content value="prices" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <PriceTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>

          <Tabs.Content value="upgrades" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <UpgradeTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>

          <Tabs.Content value="quotas" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <QuotaTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>

          <Tabs.Content value="usage-events" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <UsageEventTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>

          <Tabs.Content value="usages" className="app-tab-content">
            <ErrorBoundary>
              <Suspense fallback={<SkeletonTable theme={theme} />}>
                <UsageTable theme={theme} />
              </Suspense>
            </ErrorBoundary>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Flex>
  );
}

export default App;

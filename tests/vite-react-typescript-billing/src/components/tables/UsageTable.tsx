import { Button, Flex, Tooltip } from "@radix-ui/themes";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  Theme,
  ValueGetterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { PlusIcon } from "../../icons";
import { RefreshCwIcon } from "../../icons";
import type { Usage } from "../../api";
import { listUsagesApiUsagesGetOptions } from "../../api/@tanstack/react-query.gen";
import { AccountCell } from "../cells/AccountCell";
import { PriceCell } from "../cells/PriceCell";
import { QuotaCell } from "../cells/QuotaCell";
import { SubscriptionCell } from "../cells/SubscriptionCell";

const columnDefs: ColDef<Usage>[] = [
  {
    headerName: "Account",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.account.id,
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Usage, string>) => (
      <AccountCell accountId={value} />
    ),
    sort: "desc",
  },
  {
    headerName: "Account ID",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.account.id,
    width: 250,
    hide: true,
  },
  {
    headerName: "Subscription",
    valueGetter: (params: ValueGetterParams<Usage>) =>
      params.data?.subscription.id,
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Usage, string>) => (
      <SubscriptionCell subscriptionId={value} />
    ),
  },
  {
    headerName: "Subscription ID",
    valueGetter: (params: ValueGetterParams<Usage>) =>
      params.data?.subscription.id,
    width: 250,
    hide: true,
  },
  {
    headerName: "Price",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.price.id,
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Usage, string>) => (
      <PriceCell priceId={value} />
    ),
  },
  {
    headerName: "Price ID",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.price.id,
    width: 250,
    hide: true,
  },
  {
    headerName: "Quota",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.quota?.id,
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Usage, string>) => (
      <QuotaCell quotaId={value} />
    ),
  },
  {
    headerName: "Quota ID",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.quota?.id,
    width: 250,
    hide: true,
  },
  {
    headerName: "Metric",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.metric,
    width: 250,
  },
  {
    headerName: "Soft Limit",
    valueGetter: (params: ValueGetterParams<Usage>) =>
      params.data?.quota?.soft_limit ?? null,
    cellDataType: "number",
    width: 250,
  },
  {
    headerName: "Hard Limit",
    valueGetter: (params: ValueGetterParams<Usage>) =>
      params.data?.quota?.hard_limit ?? null,
    cellDataType: "number",
    width: 250,
  },
  {
    headerName: "Usage",
    valueGetter: (params: ValueGetterParams<Usage>) => params.data?.usage,
    cellDataType: "number",
    width: 250,
  },
  {
    headerName: "Usage (%)",
    valueGetter: (params: ValueGetterParams<Usage>) => {
      const usage = params.data?.usage ?? 0;
      const limit = params.data?.quota?.hard_limit ?? 0;
      return usage > 0 && limit > 0 ? usage / limit : 0;
    },
    valueFormatter: (params) => `${Math.round(params.value * 100)}%`,
    cellDataType: "number",
    width: 250,
  },
  {
    headerName: "Starts At",
    valueGetter: (params: ValueGetterParams<Usage>) =>
      params.data?.billing_period?.starts_at ?? null,
    cellDataType: "dateTimeString",
    width: 250,
  },
  {
    headerName: "Ends At",
    valueGetter: (params: ValueGetterParams<Usage>) =>
      params.data?.billing_period?.ends_at ?? null,
    cellDataType: "dateTimeString",
    width: 250,
  },
];

function UsageTable({ theme }: { theme: Theme }) {
  const {
    data: usages,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listUsagesApiUsagesGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  return (
    <Flex direction="column" style={{ flex: 1, height: "100%" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          theme={theme}
          rowData={usages}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            floatingFilter: true,
            resizable: true,
          }}
          getRowId={(params: GetRowIdParams<Usage>) =>
            `${params.data.account.id}-${params.data.subscription.id}-${params.data.metric}`
          }
          sideBar={{
            toolPanels: ["columns", "filters"],
          }}
          animateRows={true}
          cellSelection={true}
          enableCharts={true}
          enableCellTextSelection
          ensureDomOrder
          suppressNoRowsOverlay={true}
        />
      </div>
      <Flex
        p="2"
        justify="end"
        gap="2"
        style={{
          borderTop: "1px solid var(--gray-6)",
          backgroundColor: "var(--gray-2)",
        }}
      >
        <Button
          size="1"
          variant="soft"
          onClick={() => refetch()}
          loading={isFetching}
          style={{ width: 180 }}
        >
          <RefreshCwIcon size={14} />
          Refresh Usage
        </Button>
        <Tooltip content="Usage is reported via usage events">
          <Button size="1" variant="soft" disabled style={{ width: 180 }}>
            <PlusIcon size={14} />
            Create Usage
          </Button>
        </Tooltip>
      </Flex>
    </Flex>
  );
}

export default UsageTable;

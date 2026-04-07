import { useState } from "react";
import { Badge, Button, Flex, Tooltip } from "@radix-ui/themes";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  RowClickedEvent,
  Theme,
  ValueFormatterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { PlusIcon } from "../../icons";
import { RefreshCwIcon } from "../../icons";
import type { Period, Subscription } from "../../api";
import { listSubscriptionsApiSubscriptionsGetOptions } from "../../api/@tanstack/react-query.gen";
import { AccountCell } from "../cells/AccountCell";
import { PriceCell } from "../cells/PriceCell";
import { SubscriptionEditor } from "../editors/SubscriptionEditor";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

function isCurrentPeriod(period: Period) {
  const now = new Date();
  return new Date(period.starts_at) <= now && new Date(period.ends_at) > now;
}

const statusColors = {
  active: "green",
  trialing: "blue",
  canceled: "gray",
  paused: "bronze",
  past_due: "orange",
  incomplete: "yellow",
  incomplete_expired: "red",
  unpaid: "crimson",
} as const satisfies Record<NonNullable<Subscription["status"]>, string>;

const columnDefs: ColDef<Subscription>[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
    sort: "desc",
  },
  {
    field: "id",
    headerName: "Subscription ID",
    width: 250,
  },
  {
    headerName: "Account",
    field: "account_id",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Subscription, string>) => (
      <AccountCell accountId={value} />
    ),
  },
  {
    field: "account_id",
    headerName: "Account ID",
    width: 250,
    hide: true,
  },
  {
    headerName: "Price",
    field: "price_id",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Subscription, string>) => (
      <PriceCell priceId={value} />
    ),
  },
  {
    field: "price_id",
    headerName: "Price ID",
    width: 250,
    hide: true,
  },
  {
    field: "stripe_subscription_id",
    headerName: "Stripe Subscription ID",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Subscription, string>) =>
      value ? (
        <a
          href={`https://dashboard.stripe.com/subscriptions/${value}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent-11)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : null,
  },
  {
    field: "stripe_subscription_item_id",
    headerName: "Stripe Item ID",
    width: 250,
    cellRenderer: ({
      value,
      data,
    }: ICellRendererParams<Subscription, string>) =>
      value && data?.stripe_subscription_id ? (
        <a
          href={`https://dashboard.stripe.com/subscriptions/${data.stripe_subscription_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent-11)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span>{value}</span>
      ),
  },
  {
    field: "status",
    headerName: "Status",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Subscription, string>) => {
      const color = statusColors[value as keyof typeof statusColors];
      return <Badge color={color}>{value}</Badge>;
    },
  },
  {
    field: "billing_periods",
    headerName: "Billing Periods",
    width: 250,
    valueFormatter: (params: ValueFormatterParams<Subscription, Period[]>) => {
      const periods = params.value;
      if (!periods || periods.length === 0) return "No billing periods";
      return periods
        .map((p) => {
          const range = `${formatDate(p.starts_at)} → ${formatDate(p.ends_at)}`;
          return isCurrentPeriod(p) ? `${range} (current)` : range;
        })
        .join("; ");
    },
    autoHeight: true,
    wrapText: true,
  },
];

function SubscriptionTable({ theme }: { theme: Theme }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] =
    useState<Subscription | null>(null);

  const {
    data: subscriptions,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listSubscriptionsApiSubscriptionsGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  const handleRowClick = (event: RowClickedEvent<Subscription>) => {
    setSelectedSubscription(event.data ?? null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Flex direction="column" style={{ flex: 1, height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            theme={theme}
            rowData={subscriptions}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: true,
              resizable: true,
            }}
            getRowId={(params: GetRowIdParams<Subscription>) => params.data.id!}
            sideBar={{
              toolPanels: ["columns", "filters"],
            }}
            animateRows={true}
            cellSelection={true}
            enableCharts={true}
            enableCellTextSelection
            ensureDomOrder
            onRowClicked={handleRowClick}
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
            Refresh Subscriptions
          </Button>
          <Tooltip content="Subscriptions must be created in Stripe">
            <Button size="1" variant="soft" disabled style={{ width: 180 }}>
              <PlusIcon size={14} />
              Create Subscription
            </Button>
          </Tooltip>
        </Flex>
      </Flex>
      <SubscriptionEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        subscription={selectedSubscription}
      />
    </>
  );
}

export default SubscriptionTable;

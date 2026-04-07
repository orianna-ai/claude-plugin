import { useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
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
import type { Account } from "../../api";
import { listAccountsApiAccountsGetOptions } from "../../api/@tanstack/react-query.gen";
import { AccountEditor } from "../editors/AccountEditor";

const columnDefs: ColDef<Account>[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
    sort: "desc",
  },
  {
    field: "id",
    headerName: "Account ID",
    width: 250,
  },
  {
    field: "name",
    headerName: "Name",
    width: 250,
  },
  {
    field: "stripe_customer_id",
    headerName: "Stripe Customer ID",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Account, string>) =>
      value ? (
        <a
          href={`https://dashboard.stripe.com/customers/${value}`}
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
    field: "owner",
    headerName: "Owner",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Account, string>) =>
      value ? (
        <a
          href={`mailto:${value}`}
          style={{ color: "var(--accent-11)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : null,
  },
  {
    field: "priority",
    headerName: "Priority",
    width: 250,
    cellDataType: "number",
  },
  {
    field: "domains",
    headerName: "Domains",
    width: 250,
    valueFormatter: (params: ValueFormatterParams<Account, string[]>) =>
      params.value?.join(", ") ?? "",
  },
  {
    field: "members",
    headerName: "Members",
    width: 250,
    valueFormatter: (params: ValueFormatterParams<Account, string[]>) =>
      params.value?.join(", ") ?? "",
  },
];

function AccountTable({ theme }: { theme: Theme }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const {
    data: accounts,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listAccountsApiAccountsGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  const handleRowClick = (event: RowClickedEvent<Account>) => {
    setSelectedAccount(event.data ?? null);
    setIsEditorOpen(true);
  };

  const handleAdd = () => {
    setSelectedAccount(null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Flex direction="column" style={{ flex: 1, height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            theme={theme}
            rowData={accounts}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: true,
              resizable: true,
            }}
            getRowId={(params: GetRowIdParams<Account>) => params.data.id!}
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
            Refresh Accounts
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={handleAdd}
            style={{ width: 180 }}
          >
            <PlusIcon size={14} />
            Create Account
          </Button>
        </Flex>
      </Flex>
      <AccountEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        account={selectedAccount}
      />
    </>
  );
}

export default AccountTable;

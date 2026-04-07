import { useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  RowClickedEvent,
  Theme,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { PlusIcon } from "../../icons";
import { RefreshCwIcon } from "../../icons";
import type { Quota } from "../../api";
import { listQuotasApiQuotasGetOptions } from "../../api/@tanstack/react-query.gen";
import { PriceCell } from "../cells/PriceCell";
import { QuotaEditor } from "../editors/QuotaEditor";

const columnDefs: ColDef<Quota>[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
    sort: "desc",
  },
  {
    field: "id",
    headerName: "Quota ID",
    width: 250,
  },
  {
    headerName: "Price",
    field: "price_id",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Quota, string>) => (
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
    field: "metric",
    headerName: "Metric",
    width: 250,
  },
  {
    field: "soft_limit",
    headerName: "Soft Limit",
    width: 250,
    cellDataType: "number",
  },
  {
    field: "hard_limit",
    headerName: "Hard Limit",
    width: 250,
    cellDataType: "number",
  },
  {
    field: "is_active",
    headerName: "Active",
    width: 250,
    cellDataType: "boolean",
  },
];

function QuotaTable({ theme }: { theme: Theme }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<Quota | null>(null);

  const {
    data: quotas,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listQuotasApiQuotasGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  const handleRowClick = (event: RowClickedEvent<Quota>) => {
    setSelectedQuota(event.data ?? null);
    setIsEditorOpen(true);
  };

  const handleAdd = () => {
    setSelectedQuota(null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Flex direction="column" style={{ flex: 1, height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            theme={theme}
            rowData={quotas}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: true,
              resizable: true,
            }}
            getRowId={(params: GetRowIdParams<Quota>) => params.data.id ?? ""}
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
            Refresh Quotas
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={handleAdd}
            style={{ width: 180 }}
          >
            <PlusIcon size={14} />
            Create Quota
          </Button>
        </Flex>
      </Flex>
      <QuotaEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        quota={selectedQuota}
      />
    </>
  );
}

export default QuotaTable;

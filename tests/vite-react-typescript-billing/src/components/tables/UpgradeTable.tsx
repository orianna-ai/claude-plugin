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
import type { Upgrade } from "../../api";
import { listUpgradesApiUpgradesGetOptions } from "../../api/@tanstack/react-query.gen";
import { PriceCell } from "../cells/PriceCell";
import { UpgradeEditor } from "../editors/UpgradeEditor";

const columnDefs: ColDef<Upgrade>[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
    sort: "desc",
  },
  {
    field: "id",
    headerName: "Upgrade ID",
    width: 250,
  },
  {
    headerName: "Current Price",
    field: "current_price_id",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Upgrade, string>) => (
      <PriceCell priceId={value} />
    ),
  },
  {
    field: "current_price_id",
    headerName: "Current Price ID",
    width: 250,
    hide: true,
  },
  {
    headerName: "Upgrade Price",
    field: "upgrade_price_id",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Upgrade, string>) => (
      <PriceCell priceId={value} />
    ),
  },
  {
    field: "upgrade_price_id",
    headerName: "Upgrade Price ID",
    width: 250,
    hide: true,
  },
  {
    field: "is_active",
    headerName: "Active",
    width: 250,
    cellDataType: "boolean",
  },
];

function UpgradeTable({ theme }: { theme: Theme }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<Upgrade | null>(null);

  const {
    data: upgrades,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listUpgradesApiUpgradesGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  const handleRowClick = (event: RowClickedEvent<Upgrade>) => {
    setSelectedUpgrade(event.data ?? null);
    setIsEditorOpen(true);
  };

  const handleAdd = () => {
    setSelectedUpgrade(null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Flex direction="column" style={{ flex: 1, height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            theme={theme}
            rowData={upgrades}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: true,
              resizable: true,
            }}
            getRowId={(params: GetRowIdParams<Upgrade>) => params.data.id!}
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
            Refresh Upgrades
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={handleAdd}
            style={{ width: 180 }}
          >
            <PlusIcon size={14} />
            Create Upgrade
          </Button>
        </Flex>
      </Flex>
      <UpgradeEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        upgrade={selectedUpgrade}
      />
    </>
  );
}

export default UpgradeTable;

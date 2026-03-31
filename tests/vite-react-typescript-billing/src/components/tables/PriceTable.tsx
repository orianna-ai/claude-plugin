import { useState } from "react";
import { Button, Flex, Tooltip } from "@radix-ui/themes";
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
import type { Price } from "../../api";
import { listPricesApiPricesGetOptions } from "../../api/@tanstack/react-query.gen";
import { PriceEditor } from "../editors/PriceEditor";

const columnDefs: ColDef<Price>[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
    sort: "desc",
  },
  {
    field: "id",
    headerName: "Price ID",
    width: 250,
  },
  {
    field: "description",
    headerName: "Description",
    width: 250,
  },
  {
    field: "stripe_price_id",
    headerName: "Stripe Price ID",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Price, string>) =>
      value ? (
        <a
          href={`https://dashboard.stripe.com/prices/${value}`}
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
    field: "stripe_product_id",
    headerName: "Stripe Product ID",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<Price, string>) =>
      value ? (
        <a
          href={`https://dashboard.stripe.com/products/${value}`}
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
    field: "amount",
    headerName: "Amount",
    width: 250,
    valueFormatter: (params: ValueFormatterParams<Price, number>) => {
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: params.data?.currency ?? "usd",
      });

      return formatter.format((params.value ?? 0) / 100);
    },
  },
  {
    field: "currency",
    headerName: "Currency",
    width: 250,
  },
];

function PriceTable({ theme }: { theme: Theme }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);

  const {
    data: prices,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listPricesApiPricesGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  const handleRowClick = (event: RowClickedEvent<Price>) => {
    setSelectedPrice(event.data ?? null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Flex direction="column" style={{ flex: 1, height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            theme={theme}
            rowData={prices}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: true,
              resizable: true,
            }}
            getRowId={(params: GetRowIdParams<Price>) => params.data.id!}
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
            Refresh Prices
          </Button>
          <Tooltip content="Prices must be created in Stripe">
            <Button size="1" variant="soft" disabled style={{ width: 180 }}>
              <PlusIcon size={14} />
              Create Price
            </Button>
          </Tooltip>
        </Flex>
      </Flex>
      <PriceEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        price={selectedPrice}
      />
    </>
  );
}

export default PriceTable;

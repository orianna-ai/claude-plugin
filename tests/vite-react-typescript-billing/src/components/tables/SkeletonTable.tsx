import { Flex, Skeleton } from "@radix-ui/themes";
import type { ColDef, Theme } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

const columnDefs: ColDef[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
  },
];

function SkeletonTable({ theme }: { theme: Theme }) {
  return (
    <Flex direction="column" style={{ flex: 1, height: "100%" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AgGridReact
          theme={theme}
          rowData={[]}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            floatingFilter: true,
            resizable: true,
          }}
          loading={true}
          sideBar={{
            toolPanels: ["columns", "filters"],
          }}
          animateRows={true}
          cellSelection={true}
          enableCharts={true}
          enableCellTextSelection
          ensureDomOrder
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
        <Skeleton width="180px" height="24px" />
        <Skeleton width="180px" height="24px" />
      </Flex>
    </Flex>
  );
}

export default SkeletonTable;

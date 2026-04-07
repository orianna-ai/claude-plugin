import { useCallback, useState } from "react";
import { Button, Flex } from "@radix-ui/themes";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type {
  ColDef,
  GetRowIdParams,
  ICellRendererParams,
  Theme,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { CheckIcon } from "../../icons";
import { PlusIcon } from "../../icons";
import { RefreshCwIcon } from "../../icons";
import { UploadIcon } from "../../icons";
import { XIcon } from "../../icons";
import type { UsageEvent } from "../../api";
import {
  listUsageEventsApiUsageEventsGetOptions,
  listUsageEventsApiUsageEventsGetQueryKey,
  reportMeterEventsApiMeterEventsPostMutation,
} from "../../api/@tanstack/react-query.gen";
import { SubscriptionCell } from "../cells/SubscriptionCell";
import { UsageEventEditor } from "../editors/UsageEventEditor";

const columnDefs: ColDef<UsageEvent>[] = [
  {
    field: "created_at",
    headerName: "Created At",
    cellDataType: "dateTimeString",
    width: 250,
    sort: "desc",
  },
  {
    field: "id",
    headerName: "Usage Event ID",
    width: 250,
  },
  {
    headerName: "Subscription",
    field: "subscription_id",
    width: 250,
    cellRenderer: ({ value }: ICellRendererParams<UsageEvent, string>) => (
      <SubscriptionCell subscriptionId={value} />
    ),
  },
  {
    field: "subscription_id",
    headerName: "Subscription ID",
    width: 250,
    hide: true,
  },
  {
    field: "email",
    headerName: "Email",
    width: 250,
  },
  {
    field: "metric",
    headerName: "Metric",
    width: 250,
  },
];

function UsageEventTable({ theme }: { theme: Theme }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [reportMeterEventsStatus, setReportMeterEventsStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  const queryClient = useQueryClient();

  const {
    data: usageEvents,
    refetch,
    isFetching,
  } = useSuspenseQuery({
    ...listUsageEventsApiUsageEventsGetOptions(),
    refetchInterval: 30000,
    refetchOnMount: false,
  });

  const { mutate: reportMeterEvents } = useMutation({
    ...reportMeterEventsApiMeterEventsPostMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listUsageEventsApiUsageEventsGetQueryKey(),
      });
      setReportMeterEventsStatus("success");
      setTimeout(() => setReportMeterEventsStatus("idle"), 3000);
    },
    onError: () => {
      setReportMeterEventsStatus("error");
      setTimeout(() => setReportMeterEventsStatus("idle"), 3000);
    },
  });

  const handleAdd = useCallback(() => {
    setIsEditorOpen(true);
  }, []);

  const handleReportMeterEvents = useCallback(() => {
    setReportMeterEventsStatus("pending");
    reportMeterEvents({});
  }, [reportMeterEvents]);

  return (
    <>
      <Flex direction="column" style={{ flex: 1, height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact
            theme={theme}
            rowData={usageEvents}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: true,
              resizable: true,
            }}
            getRowId={(params: GetRowIdParams<UsageEvent>) => params.data.id}
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
            color={
              reportMeterEventsStatus === "success"
                ? "green"
                : reportMeterEventsStatus === "error"
                  ? "red"
                  : undefined
            }
            onClick={handleReportMeterEvents}
            loading={reportMeterEventsStatus === "pending"}
            style={{ width: 180 }}
          >
            {reportMeterEventsStatus === "success" ? (
              <CheckIcon size={14} />
            ) : reportMeterEventsStatus === "error" ? (
              <XIcon size={14} />
            ) : (
              <>
                <UploadIcon size={14} />
                Report Meter Events
              </>
            )}
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={() => refetch()}
            loading={isFetching}
            style={{ width: 180 }}
          >
            <RefreshCwIcon size={14} />
            Refresh Usage Events
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={handleAdd}
            style={{ width: 180 }}
          >
            <PlusIcon size={14} />
            Create Usage Event
          </Button>
        </Flex>
      </Flex>
      <UsageEventEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
    </>
  );
}

export default UsageEventTable;

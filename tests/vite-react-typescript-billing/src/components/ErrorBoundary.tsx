import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

import { RefreshCwIcon } from "../icons";

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ReactErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }: FallbackProps) => (
        <Flex align="center" justify="center" style={{ flex: 1 }}>
          <Box
            p="4"
            style={{
              backgroundColor: "var(--red-3)",
              border: "1px solid var(--red-6)",
              borderRadius: "var(--radius-3)",
              maxWidth: 360,
            }}
          >
            <Flex align="center" justify="between" gap="5">
              <Box>
                <Text as="div" size="3" weight="medium" color="red">
                  {error.name || "Error"}
                </Text>
                <Text as="div" size="2" color="gray">
                  {error.message}
                </Text>
              </Box>
              <Button
                variant="outline"
                color="red"
                onClick={resetErrorBoundary}
              >
                <RefreshCwIcon size={14} />
                Retry
              </Button>
            </Flex>
          </Box>
        </Flex>
      )}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default ErrorBoundary;

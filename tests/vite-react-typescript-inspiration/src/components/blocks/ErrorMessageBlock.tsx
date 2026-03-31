import { Box, Text } from "@radix-ui/themes";

import type { ErrorMessage } from "../../api.ts";

import "./ErrorMessageBlock.css";

export function ErrorMessageBlock({ message }: { message: ErrorMessage }) {
  return (
    <div className="error-message-block">
      <Box className="error-message-block-bubble">
        <Text as="p" className="error-message-block-content">
          {message.summary}
        </Text>
      </Box>
    </div>
  );
}

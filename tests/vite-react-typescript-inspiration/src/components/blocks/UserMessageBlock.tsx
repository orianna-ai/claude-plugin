import { Box, Text } from "@radix-ui/themes";

import type { UserMessage } from "../../api.ts";

import "./UserMessageBlock.css";

export function UserMessageBlock({ message }: { message: UserMessage }) {
  return (
    <div className="user-message-block">
      <Box className="user-message-block-bubble">
        <Text as="p" className="user-message-block-content">
          {message.text}
        </Text>
      </Box>
      {message.image_urls && message.image_urls.length > 0 && (
        <div className="user-message-block-image-grid">
          {(message.image_urls || []).map((src, i) => (
            <img key={i} src={src} alt="uploaded" />
          ))}
        </div>
      )}
    </div>
  );
}

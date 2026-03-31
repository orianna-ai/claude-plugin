import { useState } from "react";

import type { ImageContent, TextContent } from "../../../api/types.gen";
import ImageModal from "../../image-modal/ImageModal";

import "./UserMessage.css";

type Props = {
  content: (TextContent | ImageContent)[];
};

function UserMessage({ content }: Props) {
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const text = content
    .filter((content): content is TextContent => content.type === "text")
    .map((content) => content.text)
    .join("\n");

  const images = content
    .filter((content): content is ImageContent => content.type === "image")
    .map((content) => content.url);

  return (
    <div className="user-message">
      {text && (
        <div className="user-message-bubble">
          <p className="user-message-text">
            {text}
          </p>
        </div>
      )}
      {images && images.length > 0 && (
        <div className="user-message-images">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              crossOrigin="anonymous"
              onClick={() => setModalImageUrl(src)}
            />
          ))}
        </div>
      )}
      <ImageModal
        imageUrl={modalImageUrl}
        onClose={() => setModalImageUrl(null)}
      />
    </div>
  );
}

export default UserMessage;

import { Fragment, useEffect } from "react";

import type { RerankInspirationMessage } from "../../api.ts";

import { ImageGalleryBlock } from "./ImageGalleryBlock.tsx";
import { ReasoningSummaryBlock } from "./ReasoningSummaryBlock.tsx";

export function RerankInspirationMessageBlock({
  isSidePanelVisible,
  message,
  setSidePanelContent,
}: {
  isSidePanelVisible: boolean;
  message: RerankInspirationMessage;
  setSidePanelContent: (node: React.ReactNode | null) => void;
}) {
  const hasRerankedImages = (message.reranked_images?.length ?? 0) > 0;

  useEffect(() => {
    if (hasRerankedImages) {
      setSidePanelContent(
        <ImageGalleryBlock images={message.reranked_images} />,
      );
    }
  }, [hasRerankedImages, message.reranked_images, setSidePanelContent]);

  return (
    <Fragment>
      <ReasoningSummaryBlock
        isReasoning={!hasRerankedImages}
        isSidePanelVisible={isSidePanelVisible}
        reasoningSummaries={message.reranked_images_reasoning_summaries}
      />
    </Fragment>
  );
}

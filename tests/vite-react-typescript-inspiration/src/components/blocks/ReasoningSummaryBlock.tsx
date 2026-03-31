import { useEffect, useState } from "react";
import ScrollToBottom from "react-scroll-to-bottom";
import * as Accordion from "@radix-ui/react-accordion";
import { Button, Text } from "@radix-ui/themes";

import { ChevronDownIcon } from "../../icons.tsx";
import type { ReasoningSummary } from "../../api.ts";

import { TypedTextBlock } from "./TypedTextBlock.tsx";

import "./ReasoningSummaryBlock.css";

export function ReasoningSummaryBlock({
  isReasoning,
  isSidePanelVisible,
  reasoningSummaries,
}: {
  isReasoning: boolean;
  isSidePanelVisible?: boolean;
  reasoningSummaries?: ReasoningSummary[];
}) {
  const hasContent = (reasoningSummaries?.length ?? 0) > 0;

  const [accordionValue, setAccordionValue] = useState<string>(
    isReasoning && !isSidePanelVisible ? "item" : "",
  );

  useEffect(() => {
    setAccordionValue(isReasoning && !isSidePanelVisible ? "item" : "");
  }, [isReasoning, isSidePanelVisible]);

  if (!hasContent) {
    return (
      <Text
        as="span"
        className="reasoning-summary-block-title reasoning-summary-block-shimmer"
      >
        Thinking
      </Text>
    );
  } else {
    return (
      <div className={`reasoning-summary-block ${!isReasoning ? "done" : ""}`}>
        <Accordion.Root
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={setAccordionValue}
        >
          <Accordion.Item value="item">
            <Accordion.Trigger asChild>
              <Button className="reasoning-summary-block-header">
                {isReasoning ? (
                  <Text
                    as="span"
                    className="reasoning-summary-block-title reasoning-summary-block-shimmer"
                  >
                    {reasoningSummaries?.[reasoningSummaries.length - 1]?.title}
                  </Text>
                ) : (
                  <Text as="span" className="reasoning-summary-block-title">
                    {getReasoningDuration(reasoningSummaries)}
                  </Text>
                )}
                <span className="reasoning-summary-block-caret">
                  <ChevronDownIcon size={16} />
                </span>
              </Button>
            </Accordion.Trigger>
            <Accordion.Content className="reasoning-summary-block-content">
              <ScrollToBottom
                className="reasoning-summary-block-scroll"
                followButtonClassName="reasoning-summary-block-scroll-follow"
                mode="bottom"
                initialScrollBehavior="auto"
                scrollViewClassName="reasoning-summary-block-scroll-view"
              >
                <div className="reasoning-summary-block-reasoning">
                  <Text className="reasoning-summary-block-paragraph">
                    {isReasoning ? (
                      <TypedTextBlock
                        text={
                          reasoningSummaries
                            ?.map((summary) => summary.text)
                            .join(`\n\n`) ?? ""
                        }
                      />
                    ) : (
                      (reasoningSummaries
                        ?.map((summary) => summary.text)
                        .join(`\n\n`) ?? "")
                    )}
                  </Text>
                </div>
              </ScrollToBottom>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>
    );
  }
}

function getReasoningDuration(items?: ReasoningSummary[]): string {
  if (!items || items.length === 0) return "Finished thinking";
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const ms = Date.parse(last.timestamp) - Date.parse(first.timestamp);
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const duration = minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
  return `Thought for ${duration}`;
}

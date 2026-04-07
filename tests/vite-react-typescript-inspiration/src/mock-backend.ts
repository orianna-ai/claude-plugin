import type {
  Conversation,
  DriveConversationMessage,
  GatherContextMessage,
  Image,
  RerankInspirationMessage,
} from "./api.ts";

const SAMPLE_IMAGES: Image[] = [
  {
    title: "Spotify — Discover Weekly",
    caption:
      "Spotify uses a personalized playlist card with album art grid to surface algorithmic recommendations.",
    url: "https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/19779046/Screen_Shot_2020_03_09_at_9.11.45_AM.png?quality=90&strip=all&crop=16.680761099366,0,66.638477801269,100",
    labels: {
      App: "Spotify",
      Category: "Music & Audio",
      Pattern: "Personalized Recommendations",
    },
    source: {
      type: "mobbin_source",
      result: {
        app_category: "Music & Audio",
        app_id: "spotify",
        app_name: "Spotify",
        app_version_id: "v1",
        distance: 0.12,
        flow_id: "discover-weekly",
        flow_name: "Discover Weekly",
        label_group_id: "lg1",
        labels: { Pattern: "Personalized Recommendations" },
        nuance: "Uses album art grid as visual hook for playlist discovery",
        platform: "ios",
        screen_id: "s1",
        screen_index: 0,
        screen_url:
          "https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/19779046/Screen_Shot_2020_03_09_at_9.11.45_AM.png?quality=90&strip=all&crop=16.680761099366,0,66.638477801269,100",
      },
    },
  },
  {
    title: "Airbnb — Search Results",
    caption:
      "Airbnb uses a map + card split view to let users browse listings with geographic context.",
    url: "https://rankbreeze.com/wp-content/uploads/2023/09/Insights-Main-Page.png",
    labels: {
      App: "Airbnb",
      Category: "Travel",
      Pattern: "Map + List Split View",
    },
    source: {
      type: "mobbin_source",
      result: {
        app_category: "Travel",
        app_id: "airbnb",
        app_name: "Airbnb",
        app_version_id: "v1",
        distance: 0.15,
        flow_id: "search",
        flow_name: "Search Results",
        label_group_id: "lg2",
        labels: { Pattern: "Map + List Split View" },
        nuance:
          "Combines geographic browsing with rich listing cards for dual-mode exploration",
        platform: "web",
        screen_id: "s2",
        screen_index: 0,
        screen_url:
          "https://rankbreeze.com/wp-content/uploads/2023/09/Insights-Main-Page.png",
      },
    },
  },
  {
    title: "Linear — Issue Board",
    caption:
      "Linear's kanban board uses minimal chrome with status-colored pills and keyboard shortcuts.",
    url: "https://linear.app/static/release/themes/dawn.png",
    labels: {
      App: "Linear",
      Category: "Productivity",
      Pattern: "Kanban Board",
    },
    source: {
      type: "mobbin_source",
      result: {
        app_category: "Productivity",
        app_id: "linear",
        app_name: "Linear",
        app_version_id: "v1",
        distance: 0.18,
        flow_id: "board",
        flow_name: "Issue Board",
        label_group_id: "lg3",
        labels: { Pattern: "Kanban Board" },
        nuance:
          "Keyboard-first design with minimal visual noise and clear status hierarchy",
        platform: "web",
        screen_id: "s3",
        screen_index: 0,
        screen_url:
          "https://linear.app/static/release/themes/dawn.png",
      },
    },
  },
  {
    title: "Notion — Database View",
    caption:
      "Notion's table view lets users toggle between table, board, timeline, and gallery layouts.",
    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCdEua08-Ae1_egxwaUfYMzbrGnJJnsQuHpQ&s",
    labels: {
      App: "Notion",
      Category: "Productivity",
      Pattern: "Multi-View Database",
    },
    source: {
      type: "mobbin_source",
      result: {
        app_category: "Productivity",
        app_id: "notion",
        app_name: "Notion",
        app_version_id: "v1",
        distance: 0.2,
        flow_id: "database",
        flow_name: "Database View",
        label_group_id: "lg4",
        labels: { Pattern: "Multi-View Database" },
        nuance:
          "Flexible data visualization with user-controlled view switching",
        platform: "web",
        screen_id: "s4",
        screen_index: 0,
        screen_url:
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCdEua08-Ae1_egxwaUfYMzbrGnJJnsQuHpQ&s",
      },
    },
  },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ndjsonLine(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

export async function handleMockChat(
  conversation: Conversation,
  writer: WritableStreamDefaultWriter<Uint8Array>,
) {
  const encoder = new TextEncoder();
  const write = (obj: unknown) => writer.write(encoder.encode(ndjsonLine(obj)));

  const userMessages = conversation.messages.filter(
    (m) => m.type === "user_message",
  );
  const hasGatherContextReply = conversation.messages.some(
    (m) => m.type === "gather_context_message" && (m as GatherContextMessage).reply,
  );

  if (userMessages.length === 1 && !hasGatherContextReply) {
    const gatherContextId = crypto.randomUUID();
    const now = new Date().toISOString();

    await write({ type: "heartbeat_message", id: crypto.randomUUID() });

    await delay(800);
    await write({
      type: "gather_context_message",
      id: gatherContextId,
      reply_reasoning_summaries: [
        {
          text: "Understanding the design problem and identifying the key constraints...",
          timestamp: now,
          title: "Analyzing your design challenge",
        },
      ],
    } satisfies GatherContextMessage);

    await delay(1200);
    await write({
      type: "gather_context_message",
      id: gatherContextId,
      reply_reasoning_summaries: [
        {
          text: "Understanding the design problem and identifying the key constraints...",
          timestamp: now,
          title: "Analyzing your design challenge",
        },
        {
          text: "Formulating clarifying questions to better understand your needs...",
          timestamp: new Date(Date.now() + 1200).toISOString(),
          title: "Preparing follow-up questions",
        },
      ],
      reply:
        "Great question! To help find the most relevant inspiration, I'd like to understand a few things:\n\n1. **Target platform** — Is this for web, iOS, Android, or all three?\n\n2. **User expertise** — Are your users technical power-users or general consumers?\n\n3. **Visual style** — Do you lean toward minimal/clean or information-dense layouts?",
    } satisfies GatherContextMessage);
  } else {
    const rerankId = crypto.randomUUID();
    const driveId = crypto.randomUUID();
    const now = new Date().toISOString();

    await write({ type: "heartbeat_message", id: crypto.randomUUID() });

    await delay(600);
    await write({
      type: "rerank_inspiration_message",
      id: rerankId,
      reranked_images_reasoning_summaries: [
        {
          text: "Searching across design databases for patterns matching your constraints...",
          timestamp: now,
          title: "Finding relevant inspiration",
        },
      ],
    } satisfies RerankInspirationMessage);

    await delay(2000);
    await write({
      type: "rerank_inspiration_message",
      id: rerankId,
      reranked_images_reasoning_summaries: [
        {
          text: "Searching across design databases for patterns matching your constraints...",
          timestamp: now,
          title: "Finding relevant inspiration",
        },
        {
          text: "Ranking results by relevance to your specific use case and platform...",
          timestamp: new Date(Date.now() + 2000).toISOString(),
          title: "Ranking inspiration by relevance",
        },
      ],
      reranked_images: SAMPLE_IMAGES,
    } satisfies RerankInspirationMessage);

    await delay(500);
    await write({
      type: "drive_conversation_message",
      id: driveId,
      reply_reasoning_summaries: [
        {
          text: "Synthesizing findings and preparing design recommendations...",
          timestamp: new Date(Date.now() + 2500).toISOString(),
          title: "Preparing recommendations",
        },
      ],
    } satisfies DriveConversationMessage);

    await delay(1000);
    await write({
      type: "drive_conversation_message",
      id: driveId,
      reply_reasoning_summaries: [
        {
          text: "Synthesizing findings and preparing design recommendations...",
          timestamp: new Date(Date.now() + 2500).toISOString(),
          title: "Preparing recommendations",
        },
      ],
      reply:
        "Here are some patterns I found that relate to your design challenge:\n\n**Spotify's Discover Weekly** uses a personalized card with album art grids — a great example of surfacing algorithmic content in a visually engaging way without overwhelming the user.\n\n**Airbnb's split view** pairs a map with listing cards, showing how you can combine two browsing modes to give users both overview and detail simultaneously.\n\n**Linear's kanban board** demonstrates how to create an information-dense workspace that still feels clean through minimal chrome and strong visual hierarchy.\n\nWould you like me to dig deeper into any of these patterns, or explore a different design direction?",
    } satisfies DriveConversationMessage);
  }

  await writer.close();
}

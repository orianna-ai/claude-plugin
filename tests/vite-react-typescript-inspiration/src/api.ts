export type FileType = "figma" | "figjam";
export type Platform = "android" | "ios" | "web";

export interface Conversation {
  messages: (
    | DriveConversationMessage
    | ErrorMessage
    | FetchInspirationMessage
    | GatherContextMessage
    | GenerateMockMessage
    | HeartbeatMessage
    | RerankInspirationMessage
    | UserMessage
  )[];
}
export interface DriveConversationMessage {
  id?: string;
  type?: "drive_conversation_message";
  reply_reasoning_summaries?: ReasoningSummary[];
  reply?: string;
}
export interface ReasoningSummary {
  text: string;
  timestamp: string;
  title: string;
}
export interface ErrorMessage {
  id?: string;
  type?: "error_message";
  stack_trace?: string;
  summary?: string;
}
export interface FetchInspirationMessage {
  id?: string;
  type?: "fetch_inspiration_message";
  images?: Image[];
}
export interface Image {
  caption: string;
  labels: {
    [k: string]: string;
  };
  source: FigmaSource | MobbinSource;
  title: string;
  url: string;
}
export interface FigmaSource {
  type?: "figma_source";
  result: Result;
  tile: Tile;
}
export interface Result {
  distance: number;
  file_key: string;
  file_last_modified_at: string;
  file_name: string;
  file_type: FileType;
  file_version_id: string;
  label_group_id: string;
  labels: {
    [k: string]: string;
  };
  nuance: string;
  page_html_url: string;
  page_id: string;
  page_label: string | null;
  page_name: string;
  page_url: string;
  project_id: string;
  project_name: string;
  team_id: string;
  team_name: string;
  tiles: Tile[];
  [k: string]: unknown;
}
export interface Tile {
  comment_threads: CommentThread[];
  node_id: string;
  tile_absolute_x: number;
  tile_absolute_y: number;
  tile_height: number;
  tile_html_url: string | null;
  tile_id: string;
  tile_image_url: string;
  tile_type: string;
  tile_width: number;
  [k: string]: unknown;
}
export interface CommentThread {
  comments: Comment[];
  comment_absolute_x: number;
  comment_absolute_y: number;
  comment_height: number;
  comment_thread_id: string;
  comment_width: number;
  [k: string]: unknown;
}
export interface Comment {
  comment_created_at: string;
  comment_id: string;
  comment_message: string;
  comment_user: string;
  [k: string]: unknown;
}
export interface MobbinSource {
  type?: "mobbin_source";
  result: MobbinResult;
}
export interface MobbinResult {
  app_category: string;
  app_id: string;
  app_name: string;
  app_version_id: string;
  distance: number;
  flow_id: string;
  flow_name: string;
  label_group_id: string;
  labels: {
    [k: string]: string;
  };
  nuance: string;
  platform: Platform;
  screen_id: string;
  screen_index: number;
  screen_url: string;
  [k: string]: unknown;
}
export interface GatherContextMessage {
  id?: string;
  type?: "gather_context_message";
  reply_reasoning_summaries?: ReasoningSummary[];
  reply?: string;
}
export interface GenerateMockMessage {
  id?: string;
  type?: "generate_mock_message";
}
export interface HeartbeatMessage {
  id?: string;
  type?: "heartbeat_message";
}
export interface RerankInspirationMessage {
  id?: string;
  type?: "rerank_inspiration_message";
  reranked_images_reasoning_summaries?: ReasoningSummary[];
  reranked_images?: Image[];
}
export interface UserMessage {
  id?: string;
  type?: "user_message";
  text?: string;
  image_urls?: string[];
}

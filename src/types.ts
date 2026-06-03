export interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

export interface ChatHistoryItem {
  id: string;
  name: string;
  timestamp: number;
  chatData: ChatMessage[];
  user_id?: string;
}

export type ExportStyle = "modern" | "academic";

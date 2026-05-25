export interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

export interface ChatHistoryItem {
  id: string;
  name: string;
  timestamp: number;
  chatData: ChatMessage[];
}

export type ExportStyle = "modern" | "academic";

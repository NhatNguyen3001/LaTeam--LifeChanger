import type { UIMessage } from "ai";

let live: { chatId: string; messages: UIMessage[] } | null = null;

export function setLiveChatMessages(chatId: string, messages: UIMessage[]) {
  live = { chatId, messages };
}

export function getLiveChatMessages(chatId: string): UIMessage[] | null {
  if (live?.chatId !== chatId) return null;
  return live.messages;
}

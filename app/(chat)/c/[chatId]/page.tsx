import { ChatThread } from "@/components/chat/chat-thread";
import { loadChatMessages } from "@/lib/db/chat-store";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  let initialMessages: Awaited<ReturnType<typeof loadChatMessages>> = [];
  try {
    initialMessages = await loadChatMessages(chatId);
  } catch {
    // DB not ready — start an empty thread.
  }

  return <ChatThread chatId={chatId} initialMessages={initialMessages} />;
}

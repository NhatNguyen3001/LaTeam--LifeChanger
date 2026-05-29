import { ChatThread } from "@/components/chat/chat-thread";
import { loadChatMessages } from "@/lib/db/chat-store";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { chatId } = await params;
  const { q } = await searchParams;

  let initialMessages: Awaited<ReturnType<typeof loadChatMessages>> = [];
  try {
    initialMessages = await loadChatMessages(chatId);
  } catch {
    // DB not ready — start an empty thread.
  }

  return (
    <ChatThread
      key={chatId}
      chatId={chatId}
      initialMessages={initialMessages}
      initialQuery={q}
    />
  );
}

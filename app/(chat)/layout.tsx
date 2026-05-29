import { ChatShell } from "@/components/chat/chat-shell";
import { listChats } from "@/lib/db/chat-store";

export const dynamic = "force-dynamic";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let chats: { id: string; title: string }[] = [];
  try {
    chats = await listChats();
  } catch {
    // DB not ready yet — render the shell with an empty list.
  }

  return (
    <div className="h-dvh overflow-hidden">
      <ChatShell chats={chats}>{children}</ChatShell>
    </div>
  );
}

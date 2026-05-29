import { ChatSidebar } from "@/components/chat/chat-sidebar";
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
    <div className="flex h-full">
      <ChatSidebar chats={chats} />
      <main className="flex h-full min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

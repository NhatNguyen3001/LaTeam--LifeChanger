import { eq, desc } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";
import { chats, messages, dashboards } from "@/lib/db/schema";

export async function createChat(id: string, title: string) {
  await db
    .insert(chats)
    .values({ id, title: title.slice(0, 80) })
    .onConflictDoNothing();
}

export async function listChats() {
  return db
    .select({ id: chats.id, title: chats.title })
    .from(chats)
    .orderBy(desc(chats.createdAt));
}

export async function loadChatMessages(chatId: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);
  return rows.map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: r.parts as UIMessage["parts"],
  }));
}

/** Persist any dashboards composed in this turn as referenceable objects. */
export async function saveDashboards(chatId: string, msgs: UIMessage[]) {
  const rows: (typeof dashboards.$inferInsert)[] = [];
  for (const m of msgs) {
    for (const part of m.parts) {
      const p = part as { type: string; state?: string; output?: unknown };
      if (p.type === "tool-make_dashboard" && p.state === "output-available") {
        const out = p.output as { dashboardId: string; spec: unknown };
        rows.push({
          id: out.dashboardId,
          chatId,
          spec: out.spec as object,
          dataRef: out.spec as object,
        });
      }
    }
  }
  if (rows.length) await db.insert(dashboards).values(rows).onConflictDoNothing();
}

/** Replace the stored messages for a chat with the latest full list. */
export async function saveMessages(chatId: string, msgs: UIMessage[]) {
  await db.delete(messages).where(eq(messages.chatId, chatId));
  if (msgs.length === 0) return;
  await db.insert(messages).values(
    msgs.map((m) => ({
      id: m.id,
      chatId,
      role: m.role,
      parts: m.parts as unknown as object,
    })),
  );
}

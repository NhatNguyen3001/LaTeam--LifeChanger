import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { deleteChat, loadChatMessages, saveMessages, saveDashboards } from "@/lib/db/chat-store";
import { dedupeMessagesById } from "@/lib/chat/dedupe-messages";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const messages = await loadChatMessages(id);
    return NextResponse.json({ messages });
  } catch (e) {
    console.error("GET /api/chats/[id]", e);
    return NextResponse.json({ error: "Could not load messages" }, { status: 503 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const { messages } = (await req.json()) as { messages?: UIMessage[] };
    if (!messages?.length) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }
    const unique = dedupeMessagesById(messages);
    await saveMessages(id, unique);
    await saveDashboards(id, unique);
    return NextResponse.json({ ok: true, count: unique.length });
  } catch (e) {
    console.error("POST /api/chats/[id] sync", e);
    return NextResponse.json({ error: "Could not save messages" }, { status: 503 });
  }
}

export async function DELETE(  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await deleteChat(id);
  return NextResponse.json({ ok: true });
}

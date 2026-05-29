import { NextResponse } from "next/server";
import { createChat, listChats, deleteAllChats } from "@/lib/db/chat-store";

export async function GET() {
  try {
    return NextResponse.json(await listChats());
  } catch (e) {
    console.error("GET /api/chats", e);
    return NextResponse.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, title }: { id: string; title: string } = await req.json();
    if (!id || !title) {
      return NextResponse.json({ error: "id and title are required" }, { status: 400 });
    }
    await createChat(id, title);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/chats", e);
    return NextResponse.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    await deleteAllChats();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/chats", e);
    return NextResponse.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}

function dbErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("EMAXCONN") || msg.includes("max client connections")) {
    return "Database connection pool is full — restart the dev server (Ctrl+C, npm run dev) and try again.";
  }
  if (msg.includes("DATABASE_URL")) {
    return "Database is not configured. Check DATABASE_URL in .env.";
  }
  return "Could not reach the database. Check your Supabase connection and try again.";
}

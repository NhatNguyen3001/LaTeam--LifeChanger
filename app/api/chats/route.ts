import { NextResponse } from "next/server";
import { createChat, listChats } from "@/lib/db/chat-store";

export async function GET() {
  return NextResponse.json(await listChats());
}

export async function POST(req: Request) {
  const { id, title }: { id: string; title: string } = await req.json();
  if (!id || !title) {
    return NextResponse.json({ error: "id and title are required" }, { status: 400 });
  }
  await createChat(id, title);
  return NextResponse.json({ ok: true });
}

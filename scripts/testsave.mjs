import { config } from "dotenv";
import postgres from "postgres";
config({ path: ".env" });

const base = "http://localhost:3000";
const chatId = "test_" + Math.random().toString(36).slice(2, 8);

// 1) create the chat row (as the landing page does)
const c = await fetch(`${base}/api/chats`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: chatId, title: "save test" }),
});
console.log("POST /api/chats ->", c.status);

// 2) send a chat turn WITH chatId (as ChatThread.send does)
const r = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    chatId,
    messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Say hello in 3 words." }] }],
  }),
});
console.log("POST /api/chat ->", r.status);
await r.text(); // drain the stream so onFinish runs

// give onFinish a moment to write
await new Promise((res) => setTimeout(res, 1500));

// 3) inspect DB
const sql = postgres(process.env.DIRECT_URL, { prepare: false });
const msgs = await sql`select role, jsonb_array_length(parts) as nparts from messages where chat_id = ${chatId} order by created_at`;
const chat = await sql`select id, title from chats where id = ${chatId}`;
console.log("chat row:", chat);
console.log("messages saved:", msgs.length, msgs);
await sql.end();

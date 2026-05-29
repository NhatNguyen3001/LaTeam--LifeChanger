"use client";

import { useRouter } from "next/navigation";
import { MessageInput } from "@/components/chat/message-input";

const SUGGESTIONS = [
  "How are workshop ratings trending over time?",
  "Show me a dashboard of outcomes by pillar and school.",
  "What themes come up in students' open-ended feedback?",
  "Which schools are underperforming or declining?",
];

export default function NewChatPage() {
  const router = useRouter();

  async function start(text: string) {
    const id = crypto.randomUUID();
    // Create the chat row so it shows in the sidebar immediately…
    await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, title: text }),
    });
    // …stash the first message and open the thread, which will send it.
    sessionStorage.setItem(`pending:${id}`, text);
    router.push(`/c/${id}`);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            What do you want to understand?
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Ask about Lifechanger&apos;s workshops, feedback, equity reach, or
            generate an impact report — grounded in the program data.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="bg-card hover:border-ring/50 text-muted-foreground hover:text-foreground rounded-xl border px-4 py-3 text-left text-sm transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-6">
        <MessageInput onSend={start} />
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          Answers are grounded in the mock workshop-feedback dataset.
        </p>
      </div>
    </div>
  );
}

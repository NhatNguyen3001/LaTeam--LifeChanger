"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MessageInput } from "@/components/chat/message-input";
import { PILLARS, PILLAR_INSIGHTS, SUGGESTED_PROMPTS } from "@/lib/chat/constants";
import { cn } from "@/lib/utils";

export default function NewChatPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function start(text: string) {
    if (starting) return;
    setStarting(true);
    try {
      const id = crypto.randomUUID();
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, title: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          (err as { error?: string }).error ?? "Could not create chat. Is the database connected?",
        );
        return;
      }
      router.push(`/c/${id}?q=${encodeURIComponent(text)}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="lc-page">
      <div className="lc-page-scroll">
        <div className="flex flex-col gap-8 py-8">
          <div className="mx-auto w-full max-w-3xl space-y-5 text-center">
            <div className="lc-logo-mark mx-auto size-14">
              <span className="sr-only">Lifechanger</span>
            </div>
            <div className="space-y-2">
              <p className="lc-heading text-[11px] tracking-[0.2em] text-muted-foreground">
                Impact AI
              </p>
            <h1 className="lc-heading text-2xl leading-tight md:text-4xl">
              What do you want to deepdive?
            </h1>
            </div>
            <p className="text-muted-foreground mx-auto max-w-2xl text-sm leading-relaxed">
              Plain-English Q&A over Lifechanger workshops and student feedback — with
              charts in the thread and one-click impact reports.
            </p>
            <div className="space-y-3 pt-2">
              <p className="lc-heading text-[11px] tracking-[0.15em] text-muted-foreground">
                Explore by pillar
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {PILLARS.map((p) => {
                  const { blurb, prompt } = PILLAR_INSIGHTS[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={starting}
                      title={blurb}
                      onClick={() => start(prompt)}
                      className={cn(
                        "lc-pill disabled:pointer-events-none disabled:opacity-60",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground mx-auto max-w-xl text-[11px] leading-snug">
                Each pillar filters workshops by topic — ratings, themes & trends from real survey data.
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-5 p-1 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SUGGESTED_PROMPTS.map(({ title, prompt }) => (
              <button
                key={title}
                type="button"
                disabled={starting}
                onClick={() => start(prompt)}
                className={cn(
                  "lc-brown-card group rounded-3xl px-4 py-4 text-left text-sm",
                  "transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5",
                  "disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                <span className="lc-heading mb-2 block text-[10px] tracking-[0.15em]">
                  {title}
                </span>
                <span className="text-foreground/90 group-hover:text-foreground line-clamp-3 leading-snug transition-colors">
                  {prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lc-page-footer">
        <MessageInput variant="home" onSend={start} disabled={starting} />
        {starting ? (
          <p className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-[11px]">
            <Loader2 className="size-3 animate-spin" /> Loading data & starting chat…
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-center text-[11px]">
            Sample cards pre-load SQL from the workshop dataset · Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}

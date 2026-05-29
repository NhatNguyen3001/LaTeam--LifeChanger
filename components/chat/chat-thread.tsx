"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Message } from "@/components/chat/message";
import { MessageInput } from "@/components/chat/message-input";
import { dedupeMessagesById } from "@/lib/chat/dedupe-messages";
import { setLiveChatMessages } from "@/lib/chat/live-messages";
import {
  ActiveDashboardContext,
  type ActiveDashboard,
} from "@/lib/dashboard/active-context";
import type { DashboardSpec } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";

export function ChatThread({
  chatId,
  initialMessages,
  initialQuery,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const activeRef = useRef<ActiveDashboard | null>(null);
  const autoSentRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ body, messages, ...rest }) => ({
          ...rest,
          body: {
            ...body,
            messages,
            chatId,
            activeDashboard: activeRef.current ?? undefined,
          },
        }),
      }),
    [chatId],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: chatId,
    messages: dedupeMessagesById(initialMessages),
    transport,
    onError: (e) => {
      toast.error(e.message || "Could not reach the assistant. Check API keys and try again.");
    },
  });

  const displayMessages = useMemo(() => dedupeMessagesById(messages), [messages]);

  useEffect(() => {
    if (displayMessages.length > 0) {
      setLiveChatMessages(chatId, displayMessages);
    }
  }, [chatId, displayMessages]);

  const prevStatusRef = useRef(status);

  // Persist full thread when a reply finishes (so reports & sidebar work).
  useEffect(() => {
    if (
      prevStatusRef.current !== "ready" &&
      status === "ready" &&
      displayMessages.length > 0
    ) {
      fetch(`/api/chats/${chatId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: displayMessages }),
      })
        .then(() => router.refresh())
        .catch(() => {});
    }
    prevStatusRef.current = status;
  }, [status, chatId, displayMessages, router]);

  // Fallback: fetch from API if server render returned empty but chat exists.
  useEffect(() => {
    if (initialMessages.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: UIMessage[] };
        if (!cancelled && data.messages && data.messages.length > 0) {
          setMessages(dedupeMessagesById(data.messages));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, initialMessages.length, setMessages]);

  const dashboardCtx = useRef({
    activate: (id: string, spec: DashboardSpec) => {
      activeRef.current = {
        id,
        title: spec.title,
        filters: activeRef.current?.id === id ? activeRef.current.filters : {},
        spec,
      };
    },
    updateFilters: (id: string, spec: DashboardSpec, filters: Record<string, string[]>) => {
      activeRef.current = { id, title: spec.title, filters, spec };
    },
  }).current;

  const send = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage],
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-send first message from landing-page sample prompts (?q= avoids Strict Mode sessionStorage loss).
  useEffect(() => {
    if (autoSentRef.current || initialMessages.length > 0) return;
    const q = initialQuery?.trim();
    if (!q) return;
    autoSentRef.current = true;
    router.replace(`/c/${chatId}`, { scroll: false });
    send(q);
  }, [chatId, initialQuery, initialMessages.length, send, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const isEmpty = displayMessages.length === 0 && !busy;

  return (
    <ActiveDashboardContext.Provider value={dashboardCtx}>
      <div className="lc-page">
        <div className="lc-page-scroll">
          {isEmpty ? (
            <div className="text-muted-foreground flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
              <MessageSquare className="size-10 opacity-30" />
              <p className="text-sm">
                {busy ? "Loading answer from program data…" : "Send a message to analyse program data."}
              </p>
            </div>
          ) : (
            <div className="space-y-8 pb-2">
              {displayMessages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
              {status === "submitted" && (
                <div className="text-muted-foreground flex items-center gap-3 text-sm">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                  <span>Querying workshops & feedback…</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="border-destructive/30 bg-destructive/5 mt-4 flex items-start gap-3 rounded-xl border p-4 text-sm">
              <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium">Something went wrong</p>
                <p className="text-muted-foreground">{error.message}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const lastUser = [...displayMessages].reverse().find((m) => m.role === "user");
                    const text = lastUser?.parts
                      .filter((p) => p.type === "text")
                      .map((p) => (p as { text: string }).text)
                      .join("");
                    if (text) send(text);
                  }}
                >
                  Retry last question
                </Button>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-2" />
        </div>

        <div className="lc-page-footer">
          <MessageInput variant="home" onSend={send} disabled={busy} />
          <p className="text-muted-foreground mt-2 hidden text-center text-[11px] sm:block">
            Sample prompts on the home page load pre-fetched data · filter dashboards, then ask
            &quot;why?&quot;
          </p>
        </div>
      </div>
    </ActiveDashboardContext.Provider>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { Message } from "@/components/chat/message";
import { MessageInput } from "@/components/chat/message-input";
import {
  ActiveDashboardContext,
  type ActiveDashboard,
} from "@/lib/dashboard/active-context";
import type { DashboardSpec } from "@/lib/dashboard/types";

export function ChatThread({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: UIMessage[];
}) {
  const { messages, sendMessage, status } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  // The dashboard the user is currently looking at / interacting with.
  const activeRef = useRef<ActiveDashboard | null>(null);
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

  // Single send path — always attaches chatId + the active dashboard snapshot.
  const send = useCallback(
    (text: string) => {
      sendMessage(
        { text },
        { body: { chatId, activeDashboard: activeRef.current ?? undefined } },
      );
    },
    [chatId, sendMessage],
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const sentPending = useRef(false);

  // Auto-send the message typed on the landing page (stashed before navigation).
  useEffect(() => {
    if (sentPending.current) return;
    const key = `pending:${chatId}`;
    const pending = sessionStorage.getItem(key);
    if (pending && initialMessages.length === 0) {
      sentPending.current = true;
      sessionStorage.removeItem(key);
      send(pending);
    }
  }, [chatId, initialMessages.length, send]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  return (
    <ActiveDashboardContext.Provider value={dashboardCtx}>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4">
        <div className="flex-1 space-y-6 overflow-y-auto py-6">
          {messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          {status === "submitted" && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="pb-6">
          <MessageInput onSend={send} disabled={busy} />
        </div>
      </div>
    </ActiveDashboardContext.Provider>
  );
}

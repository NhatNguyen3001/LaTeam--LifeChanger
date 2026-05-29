"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, MessageSquare, FileText, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AUDIENCES, type Audience } from "@/lib/report/types";
import type { UIMessage } from "ai";
import { getLiveChatMessages } from "@/lib/chat/live-messages";

const AUDIENCE_LABEL: Record<Audience, string> = {
  funder: "Report for funders",
  school: "Report for schools",
  board: "Report for board",
};

function GenerateReport() {
  const pathname = usePathname();
  const [loading, setLoading] = useState<Audience | null>(null);

  const chatId = pathname.match(/^\/c\/([^/]+)/)?.[1];

  async function openReport(audience: Audience) {
    if (!chatId) {
      window.open(`/report/preview/${audience}`, "_blank");
      return;
    }

    setLoading(audience);
    const t = toast.loading(`Building ${AUDIENCE_LABEL[audience].toLowerCase()}…`);
    try {
      const live = getLiveChatMessages(chatId);
      if (live?.length) {
        await fetch(`/api/chats/${chatId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: live }),
        });
      }

      const threadRes = await fetch(`/api/chats/${chatId}`);
      let payloadMessages: UIMessage[] | undefined = live ?? undefined;
      if (threadRes.ok) {
        const data = (await threadRes.json()) as { messages?: UIMessage[] };
        if (data.messages?.length) {
          payloadMessages = data.messages;
        }
      }

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audience, chatId, messages: payloadMessages }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      const { id } = await res.json();
      toast.success("Report ready — opening in a new tab", { id: t });
      window.open(`/report/${id}`, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate report", { id: t });
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/90 hover:bg-sidebar-accent w-full justify-start gap-2"
            disabled={loading != null}
            title="Impact report by audience"
          >
            {loading != null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Generate impact report
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-60">
        <p className="text-muted-foreground px-2 py-1.5 text-[11px] leading-snug">
          {chatId
            ? "Uses this conversation’s analysis and charts."
            : "Uses program-wide data. Open a chat first to report from that thread."}
        </p>
        {AUDIENCES.map((a) => (
          <DropdownMenuItem key={a} onClick={() => openReport(a)} disabled={loading != null}>
            <span className="flex flex-col gap-0.5">
              <span>{AUDIENCE_LABEL[a]}</span>
              <span className="text-muted-foreground text-[10px] font-normal normal-case">
                {chatId ? "From this chat" : "Program overview"}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type ChatListItem = {
  id: string;
  title: string;
};

export function ChatSidebar({
  chats = [],
  className,
  onNavigate,
  headerAction,
}: {
  chats?: ChatListItem[];
  className?: string;
  onNavigate?: () => void;
  headerAction?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState<string | "all" | null>(null);

  async function removeChat(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(id);
    try {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Chat deleted");
      if (pathname === `/c/${id}`) router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not delete chat");
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    if (chats.length === 0) return;
    if (!window.confirm(`Delete all ${chats.length} conversations? This cannot be undone.`)) {
      return;
    }
    setBusy("all");
    try {
      const res = await fetch("/api/chats", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("All chats cleared");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not clear chats");
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex h-full w-72 shrink-0 flex-col border-r-2 border-sidebar-border shadow-xl md:shadow-none",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b-2 border-sidebar-border px-4 py-4">
        <div className="lc-logo-mark" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="lc-heading truncate text-sm leading-tight">Lifechanger</p>
          <p className="text-muted-foreground truncate text-[10px] font-medium tracking-[0.12em] uppercase">
            Impact AI
          </p>
        </div>
        {headerAction}
      </div>

      <div className="px-3 pt-3">
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            buttonVariants({ variant: "default" }),
            "lc-heading w-full justify-start gap-2 border-2 border-foreground text-[11px] tracking-[0.1em] shadow-[3px_3px_0_0_var(--lc-tan)]",
          )}
        >
          <Plus className="size-4" />
          New chat
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <span className="lc-heading text-[10px] tracking-[0.15em] text-muted-foreground">
          Conversations
        </span>
        {chats.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-7 gap-1 px-2 text-[10px]"
            disabled={busy === "all"}
            onClick={clearAll}
          >
            {busy === "all" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Trash2 className="size-3" />
            )}
            Clear all
          </Button>
        )}
      </div>

      <ScrollArea className="mt-1 min-h-0 flex-1 px-2">
        {chats.length === 0 ? (
          <div className="text-muted-foreground mx-1 rounded-2xl border-2 border-dashed border-lc-tan bg-sidebar-accent px-3 py-8 text-center">
            <MessageSquare className="mx-auto mb-2 size-8 opacity-40" />
            <p className="text-xs leading-relaxed">
              No chats yet. Start with a question about workshops, schools, or feedback.
            </p>
          </div>
        ) : (
          <nav className="flex flex-col gap-0.5 pb-4">
            {chats.map((chat) => {
              const href = `/c/${chat.id}`;
              const active = pathname === href;
              const deleting = busy === chat.id;
              return (
                <div
                  key={chat.id}
                  className={cn(
                    "group flex items-center gap-0.5 rounded-lg",
                    active && "bg-sidebar-primary shadow-[2px_2px_0_0_var(--lc-tan)]",
                  )}
                >
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "text-sidebar-primary-foreground"
                        : "hover:bg-sidebar-accent/80 text-sidebar-foreground/85",
                    )}
                  >
                    <MessageSquare className="size-4 shrink-0 opacity-70" />
                    <span className="truncate">{chat.title}</span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8 shrink-0 opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100",
                      active && "text-sidebar-primary-foreground hover:bg-white/10 md:opacity-100",
                    )}
                    disabled={deleting}
                    aria-label={`Delete chat: ${chat.title}`}
                    onClick={(e) => removeChat(chat.id, e)}
                  >
                    {deleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </nav>
        )}
      </ScrollArea>

      <div className="border-sidebar-border/80 space-y-1 border-t px-3 py-3">
        <GenerateReport />
        <p className="text-muted-foreground px-1 text-[10px] leading-snug">
          Demo workspace · grounded in workshop feedback data
        </p>
      </div>
    </aside>
  );
}

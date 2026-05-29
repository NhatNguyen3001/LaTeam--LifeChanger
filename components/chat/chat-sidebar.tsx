"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Plus, MessageSquare, Sparkles, FileText, Loader2 } from "lucide-react";
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

const AUDIENCE_LABEL: Record<Audience, string> = {
  funder: "For a funder",
  school: "For a school",
  board: "For the board",
};

function GenerateReport() {
  const [loading, setLoading] = useState(false);

  async function generate(audience: Audience) {
    setLoading(true);
    const t = toast.loading(`Generating ${audience} impact report…`);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audience }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      toast.success("Report ready", { id: t });
      window.open(`/report/${id}`, "_blank");
    } catch {
      toast.error("Could not generate report", { id: t });
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Generate impact report
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-48">
        {AUDIENCES.map((a) => (
          <DropdownMenuItem key={a} onClick={() => generate(a)}>
            {AUDIENCE_LABEL[a]}
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

export function ChatSidebar({ chats = [] }: { chats?: ChatListItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-full w-72 shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 px-4 py-4">
        <Sparkles className="size-5 text-chart-1" />
        <span className="font-heading text-sm font-semibold">
          Lifechanger Impact AI
        </span>
      </div>

      <div className="px-3">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-start gap-2",
          )}
        >
          <Plus className="size-4" />
          New chat
        </Link>
      </div>

      <ScrollArea className="mt-4 flex-1 px-3">
        {chats.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-xs">
            No conversations yet. Ask a question to get started.
          </p>
        ) : (
          <nav className="flex flex-col gap-1 pb-4">
            {chats.map((chat) => {
              const href = `/c/${chat.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={chat.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80",
                  )}
                >
                  <MessageSquare className="size-4 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </ScrollArea>

      <div className="border-t px-3 py-2">
        <GenerateReport />
      </div>
      <div className="text-muted-foreground px-4 pb-3 text-[11px]">
        Demo workspace · mock Salesforce export
      </div>
    </aside>
  );
}

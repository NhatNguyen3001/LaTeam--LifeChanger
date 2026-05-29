"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatSidebar, type ChatListItem } from "@/components/chat/chat-sidebar";

export function ChatShell({
  chats,
  children,
}: {
  chats: ChatListItem[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <ChatSidebar
        chats={chats}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        onNavigate={() => setMobileOpen(false)}
        headerAction={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-lc-tan bg-card/90 flex shrink-0 items-center gap-3 border-b-2 px-4 py-3 backdrop-blur-md md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 border-2 border-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="lc-heading text-sm leading-tight">Lifechanger Impact AI</p>
            <p className="text-muted-foreground truncate text-[11px]">
              Program data · workshops & feedback
            </p>
          </div>
        </header>

        <main className="bg-chat-main relative flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

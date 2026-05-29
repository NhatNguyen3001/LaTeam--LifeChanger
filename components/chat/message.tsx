"use client";

import type { UIMessage } from "ai";
import { Loader2, Database, Search, Wrench, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/components/dashboard/dashboard";
import { MarkdownContent } from "@/components/chat/markdown-content";
import type { DashboardSpec } from "@/lib/dashboard/types";

const TOOL_LABELS: Record<string, { label: string; icon: typeof Wrench }> = {
  query_data: { label: "Queried program data", icon: Database },
  search_feedback: { label: "Searched student feedback", icon: Search },
  make_dashboard: { label: "Built dashboard", icon: Wrench },
};

function ToolChip({ name, running }: { name: string; running: boolean }) {
  const meta = TOOL_LABELS[name] ?? { label: name, icon: Wrench };
  const Icon = running ? Loader2 : meta.icon;
  return (
    <div className="lc-pill inline-flex items-center gap-1.5 py-1.5 text-xs normal-case tracking-normal">
      <Icon className={cn("size-3.5", running && "animate-spin")} />
      {running ? "Working…" : meta.label}
    </div>
  );
}

export function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border",
          isUser
            ? "border-foreground bg-white text-foreground"
            : "border-foreground bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
      </div>

      <div
        className={cn(
          "min-w-0 space-y-3",
          isUser ? "max-w-[min(90%,32rem)] lg:max-w-xl" : "max-w-full flex-1",
        )}
      >
        <p className="lc-heading text-[10px] tracking-[0.12em] text-muted-foreground">
          {isUser ? "You" : "Impact AI"}
        </p>

        {message.parts.map((part, i) => {
          const partKey =
            "toolCallId" in part && typeof part.toolCallId === "string"
              ? part.toolCallId
              : `${part.type}-${i}`;
          if (part.type === "text") {
            return (
              <div
                key={partKey}
                className={cn(
                  isUser
                    ? "rounded-2xl rounded-tr-md border border-foreground bg-white px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                    : "lc-brown-card rounded-3xl px-4 py-4",
                )}
              >
                {isUser ? (
                  part.text
                ) : (
                  <MarkdownContent content={part.text} />
                )}
              </div>
            );
          }
          if (part.type === "reasoning") {
            return null;
          }
          if (part.type === "tool-make_dashboard") {
            if ("state" in part && part.state === "output-available") {
              const out = part.output as { dashboardId: string; spec: DashboardSpec };
              return <Dashboard key={partKey} spec={out.spec} dashboardId={out.dashboardId} />;
            }
            return <ToolChip key={partKey} name="make_dashboard" running />;
          }
          if (part.type.startsWith("tool-")) {
            const name = part.type.slice("tool-".length);
            const running =
              "state" in part &&
              part.state !== "output-available" &&
              part.state !== "output-error";
            if ("state" in part && part.state === "output-error") {
              return (
                <div
                  key={partKey}
                  className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-3 py-2 text-xs"
                >
                  Tool &quot;{name}&quot; failed — check database connection and API keys.
                </div>
              );
            }
            return <ToolChip key={partKey} name={name} running={running} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

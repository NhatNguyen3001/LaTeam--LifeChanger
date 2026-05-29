"use client";

import type { UIMessage } from "ai";
import { Loader2, Database, Search, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { DashboardSpec } from "@/lib/dashboard/types";

const TOOL_LABELS: Record<string, { label: string; icon: typeof Wrench }> = {
  query_data: { label: "Queried the data", icon: Database },
  search_feedback: { label: "Searched feedback", icon: Search },
  make_dashboard: { label: "Built a dashboard", icon: Wrench },
};

function ToolChip({ name, running }: { name: string; running: boolean }) {
  const meta = TOOL_LABELS[name] ?? { label: name, icon: Wrench };
  const Icon = running ? Loader2 : meta.icon;
  return (
    <div className="text-muted-foreground bg-muted/50 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
      <Icon className={cn("size-3.5", running && "animate-spin")} />
      {running ? `${meta.label.replace(/ed /, "ing ").replace(/ed$/, "ing")}…` : meta.label}
    </div>
  );
}

export function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "space-y-2",
          isUser
            ? "bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-4 py-2.5"
            : "w-full",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }
          if (part.type === "reasoning") {
            return null;
          }
          if (part.type === "tool-make_dashboard") {
            if ("state" in part && part.state === "output-available") {
              const out = part.output as { dashboardId: string; spec: DashboardSpec };
              return <Dashboard key={i} spec={out.spec} dashboardId={out.dashboardId} />;
            }
            return <ToolChip key={i} name="make_dashboard" running />;
          }
          if (part.type.startsWith("tool-")) {
            const name = part.type.slice("tool-".length);
            const running =
              "state" in part &&
              part.state !== "output-available" &&
              part.state !== "output-error";
            return <ToolChip key={i} name={name} running={running} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

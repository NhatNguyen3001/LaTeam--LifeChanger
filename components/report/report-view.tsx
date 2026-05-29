"use client";

import { Printer, Sparkles } from "lucide-react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Button } from "@/components/ui/button";
import type { ReportSpec } from "@/lib/report/types";

const AUDIENCE_LABEL: Record<string, string> = {
  funder: "Funder report",
  school: "School report",
  board: "Board report",
};

export function ReportView({ spec }: { spec: ReportSpec }) {
  const byId = new Map(spec.widgets.map((w) => [w.id, w]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-chart-1 size-5" />
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            Lifechanger · {AUDIENCE_LABEL[spec.audience] ?? "Impact report"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="no-print gap-1.5"
          onClick={() => window.print()}
        >
          <Printer className="size-4" /> Print / Save as PDF
        </Button>
      </div>

      <header className="mb-8 space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{spec.title}</h1>
        {spec.subtitle && <p className="text-muted-foreground text-lg">{spec.subtitle}</p>}
        <p className="text-muted-foreground text-xs">
          Generated {new Date(spec.generatedAt).toLocaleDateString()}
        </p>
      </header>

      <div className="space-y-10">
        {spec.sections.map((section, i) => {
          const widgets = (section.widgetIds ?? [])
            .map((id) => byId.get(id))
            .filter((w): w is NonNullable<typeof w> => Boolean(w));
          return (
            <section key={i} className="space-y-4">
              <h2 className="font-heading text-xl font-semibold">{section.heading}</h2>
              {section.body.split(/\n\n+/).map((p, pi) => (
                <p key={pi} className="text-sm leading-relaxed">
                  {p}
                </p>
              ))}
              {widgets.length > 0 && <Dashboard spec={{ title: "", widgets }} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

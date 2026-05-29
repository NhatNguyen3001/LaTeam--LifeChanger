"use client";

import { Printer } from "lucide-react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { AUDIENCE_TEMPLATES } from "@/lib/report/audience-templates";
import type { ReportSpec } from "@/lib/report/types";
import type { Widget } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

const AUDIENCE_LABEL: Record<string, string> = {
  funder: "For funders",
  school: "For schools",
  board: "Internal / board",
};

function heroStats(spec: ReportSpec): Widget[] {
  const ids = AUDIENCE_TEMPLATES[spec.audience].heroWidgetIds;
  const byId = new Map(spec.widgets.map((w) => [w.id ?? "", w]));
  return ids.map((id) => byId.get(id)).filter((w): w is Widget => Boolean(w));
}

function SectionBody({ body }: { body: string }) {
  return (
    <div className="prose-sm max-w-none">
      <MarkdownContent content={body} />
    </div>
  );
}

export function ReportView({ spec }: { spec: ReportSpec }) {
  const template = AUDIENCE_TEMPLATES[spec.audience];
  const byId = new Map(spec.widgets.map((w) => [w.id, w]));
  const hero = heroStats(spec);

  return (
    <div className="bg-background min-h-full">
      <div className="lc-page mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 print:max-w-none print:px-8">
        {/* Top bar */}
        <div className="no-print mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="lc-logo-mark size-10" aria-hidden />
            <div>
              <p className="lc-heading text-[10px] tracking-[0.15em] text-muted-foreground">
                Lifechanger Impact AI
              </p>
              <p className="lc-heading text-sm">{AUDIENCE_LABEL[spec.audience]}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-foreground"
            onClick={() => window.print()}
          >
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
        </div>

        {/* Hero */}
        <header className="lc-brown-card mb-8 rounded-3xl p-6 md:p-8">
          <p className="lc-heading mb-2 text-[10px] tracking-[0.2em] opacity-80">
            {template.accentLabel}
          </p>
          <h1 className="lc-heading text-2xl md:text-4xl">{spec.title}</h1>
          {(spec.subtitle || template.subtitle) && (
            <p className="mt-2 text-base opacity-90 md:text-lg">
              {spec.subtitle ?? template.subtitle}
            </p>
          )}
          <p className="mt-3 text-[11px] uppercase tracking-widest opacity-70">
            {template.tagline}
          </p>
          <p className="mt-4 text-xs opacity-70" suppressHydrationWarning>
            Generated {new Date(spec.generatedAt).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {spec.sourceChatId ? " · from conversation analysis" : " · program overview"}
          </p>
        </header>

        {/* Executive summary */}
        {spec.executiveSummary && (
          <section className="mb-8 rounded-2xl border-2 border-foreground bg-white p-5 md:p-6">
            <h2 className="lc-heading mb-3 text-sm tracking-[0.12em]">Executive summary</h2>
            <p className="text-sm leading-relaxed md:text-base">{spec.executiveSummary}</p>
          </section>
        )}

        {/* Hero KPIs */}
        {hero.length > 0 && (
          <section className="mb-8">
            <h2 className="lc-heading mb-4 text-sm tracking-[0.12em] text-muted-foreground">
              Key metrics
            </h2>
            <Dashboard spec={{ title: "", widgets: hero }} />
          </section>
        )}

        {/* Key takeaways */}
        {spec.keyTakeaways && spec.keyTakeaways.length > 0 && (
          <section className="mb-10 rounded-2xl border border-foreground/20 bg-white p-5">
            <h2 className="lc-heading mb-4 text-sm tracking-[0.12em]">
              {spec.audience === "board"
                ? "Strategic takeaways"
                : spec.audience === "school"
                  ? "What matters for your school"
                  : "What funders should know"}
            </h2>
            <ul className="space-y-2">
              {spec.keyTakeaways.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug">
                  <span className="bg-primary lc-heading flex size-6 shrink-0 items-center justify-center rounded-full text-[10px]">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sections */}
        <div className="space-y-10">
          {spec.sections.map((section, i) => {
            const widgets = (section.widgetIds ?? [])
              .map((id) => byId.get(id))
              .filter((w): w is NonNullable<typeof w> => Boolean(w));
            const isQuotes =
              /own words|student voice|voices/i.test(section.heading) &&
              spec.quotes.length > 0;

            return (
              <section
                key={i}
                className={cn(
                  "space-y-4",
                  i > 0 && "border-t border-foreground/15 pt-10",
                )}
              >
                <h2 className="lc-heading text-xl md:text-2xl">{section.heading}</h2>
                <SectionBody body={section.body} />

                {isQuotes && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {spec.quotes.slice(0, 4).map((q, qi) => (
                      <blockquote
                        key={qi}
                        className="lc-brown-card rounded-2xl px-4 py-4 text-sm italic"
                      >
                        &ldquo;{q.text}&rdquo;
                        <footer className="lc-heading mt-2 block text-[10px] not-italic tracking-[0.1em] opacity-80">
                          — {q.topic} workshop
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                )}

                {widgets.length > 0 && (
                  <Dashboard spec={{ title: "", widgets }} />
                )}
              </section>
            );
          })}
        </div>

        <footer className="text-muted-foreground mt-12 border-t border-foreground/15 pt-6 text-center text-[11px]">
          Lifechanger Impact AI · De-identified student data · For authorised use only
        </footer>
      </div>
    </div>
  );
}

import type { UIMessage } from "ai";
import type { DashboardSpec, Widget } from "@/lib/dashboard/types";
import { textFromMessage } from "@/lib/chat/message-parts";

export type ChatReportContext = {
  transcript: string;
  assistantInsights: string[];
  userQuestions: string[];
  widgets: Widget[];
  quotes: { text: string; topic: string }[];
};

/** Pull quoted strings from assistant prose (de-id student voices already in chat). */function extractQuotes(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /"([^"]{12,280})"/g,
    /'([^']{12,280})'/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const q = m[1].trim();
      if (q && !found.includes(q)) found.push(q);
    }
  }
  return found.slice(0, 6);
}

function widgetsFromSpec(spec: DashboardSpec, prefix: string): Widget[] {
  let i = 0;
  return spec.widgets.map((w) => ({
    ...w,
    id: w.id ?? `${prefix}-w${i++}`,
  }));
}

/**
 * Build report inputs from a saved chat thread — not the global default aggregates.
 */
export function extractChatReportContext(messages: UIMessage[]): ChatReportContext {
  const userQuestions: string[] = [];
  const assistantInsights: string[] = [];
  const widgets: Widget[] = [];
  const quoteTexts: string[] = [];
  let dashboardIdx = 0;

  const transcriptLines: string[] = [];

  for (const m of messages) {
    const label = m.role === "user" ? "Staff" : "Impact AI";
    const text = textFromMessage(m);
    if (text) transcriptLines.push(`${label}: ${text}`);

    if (m.role === "user" && text) {
      userQuestions.push(text);
    }

    if (m.role === "assistant") {
      if (text) {
        assistantInsights.push(text);
        for (const q of extractQuotes(text)) quoteTexts.push(q);
      }

      for (const part of m.parts) {
        const p = part as { type: string; state?: string; output?: unknown };
        if (p.type === "tool-make_dashboard" && p.state === "output-available") {
          const out = p.output as { dashboardId: string; spec: DashboardSpec };
          widgets.push(...widgetsFromSpec(out.spec, out.dashboardId || `dsh-${dashboardIdx}`));
          dashboardIdx++;
        }
      }
    }
  }

  const quotes = quoteTexts.map((text) => ({ text, topic: "from conversation" }));

  return {
    transcript: transcriptLines.join("\n\n"),
    assistantInsights,
    userQuestions,
    widgets,
    quotes,
  };
}

export function mergeDashboardRows(
  fromMessages: Widget[],
  fromDb: { id: string; spec: DashboardSpec }[],
): Widget[] {
  const merged = [...fromMessages];
  const seen = new Set(fromMessages.map((w) => w.id).filter(Boolean));

  for (const row of fromDb) {
    const extra = widgetsFromSpec(row.spec, row.id);
    for (const w of extra) {
      if (w.id && seen.has(w.id)) continue;
      if (w.id) seen.add(w.id);
      merged.push(w);
    }
  }
  return merged;
}

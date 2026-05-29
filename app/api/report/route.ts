import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { REPORT_MODEL } from "@/lib/ai/models";
import { gatherAggregates } from "@/lib/report/aggregates";
import {
  reportNarrative,
  AUDIENCES,
  AUDIENCE_GUIDANCE,
  type Audience,
  type ReportSpec,
} from "@/lib/report/types";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { audience }: { audience: Audience } = await req.json();
  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: "invalid audience" }, { status: 400 });
  }

  const { widgets, quotes, summary } = await gatherAggregates();
  const available = widgets.map((w) => ({
    id: w.id,
    kind: w.kind,
    title: "title" in w ? w.title : w.label,
  }));

  const { object } = await generateObject({
    model: anthropic(REPORT_MODEL),
    schema: reportNarrative,
    prompt:
      `Write a Lifechanger impact report.\n${AUDIENCE_GUIDANCE[audience]}\n\n` +
      `De-identification: never use student names; you may quote the provided heartwarming quotes ` +
      `verbatim; report equity dimensions only as aggregates.\n\n` +
      `Program aggregates (JSON):\n${JSON.stringify(summary)}\n\n` +
      `Heartwarming student quotes you may use:\n${JSON.stringify(quotes)}\n\n` +
      `Available charts (reference by id in section.widgetIds):\n${JSON.stringify(available)}\n\n` +
      `Write 4-6 sections with clear headings and concrete narrative grounded in the numbers. ` +
      `Reference the most relevant charts by id. Include a short "student voices" section using 1-2 quotes.`,
  });

  const id = `rpt_${Math.random().toString(36).slice(2, 10)}`;
  const spec: ReportSpec = {
    ...object,
    audience,
    generatedAt: new Date().toISOString(),
    widgets,
    quotes,
  };
  await db.insert(reports).values({ id, audience, spec: spec as object });

  return NextResponse.json({ id });
}

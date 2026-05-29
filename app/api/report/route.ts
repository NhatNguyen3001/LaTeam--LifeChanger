import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { REPORT_MODEL } from "@/lib/ai/models";
import {
  reportNarrative,
  AUDIENCES,
  AUDIENCE_GUIDANCE,
  type Audience,
  type ReportSpec,
} from "@/lib/report/types";
import {
  extractChatReportContext,
  mergeDashboardRows,
} from "@/lib/report/from-chat";
import { gatherAggregates } from "@/lib/report/aggregates";
import {
  AUDIENCE_TEMPLATES,
  pickWidgetsForAudience,
  templateSectionPrompt,
} from "@/lib/report/audience-templates";
import { getChat, loadChatMessages, saveMessages, saveDashboards } from "@/lib/db/chat-store";
import { dedupeMessagesById } from "@/lib/chat/dedupe-messages";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";
import { dashboards, reports } from "@/lib/db/schema";
import type { DashboardSpec } from "@/lib/dashboard/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const json = await req.json();
  const { audience, chatId }: { audience: Audience; chatId?: string; messages?: UIMessage[] } =
    json;

  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: "invalid audience" }, { status: 400 });
  }
  if (!chatId) {
    return NextResponse.json(
      { error: "chatId required — open a conversation and generate from that thread" },
      { status: 400 },
    );
  }

  const chat = await getChat(chatId);
  if (!chat) {
    return NextResponse.json({ error: "chat not found" }, { status: 404 });
  }

  let messages = await loadChatMessages(chatId);
  const clientMessages = Array.isArray(json.messages)
    ? dedupeMessagesById(json.messages as UIMessage[])
    : [];

  if (clientMessages.length > 0) {
    const ctxClient = extractChatReportContext(clientMessages);
    const ctxDb = extractChatReportContext(messages);
    if (
      ctxClient.assistantInsights.length > 0 &&
      ctxClient.assistantInsights.length >= ctxDb.assistantInsights.length
    ) {
      messages = clientMessages;
      try {
        await saveMessages(chatId, clientMessages);
        await saveDashboards(chatId, clientMessages);
      } catch (e) {
        console.error("POST /api/report sync messages", e);
      }
    }
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "this chat has no messages yet — ask a question first" },
      { status: 400 },
    );
  }

  const ctx = extractChatReportContext(messages);
  if (ctx.assistantInsights.length === 0) {
    return NextResponse.json(
      {
        error:
          "No assistant analysis found in this chat yet. Wait for the reply to finish, refresh the page, then try again.",
      },
      { status: 400 },
    );
  }

  const dashRows = await db
    .select({ id: dashboards.id, spec: dashboards.spec })
    .from(dashboards)
    .where(eq(dashboards.chatId, chatId));

  const widgets = pickWidgetsForAudience(
    mergeDashboardRows(
      ctx.widgets,
      dashRows.map((r) => ({ id: r.id, spec: r.spec as DashboardSpec })),
    ),
    audience,
  );

  // Supplement with program-wide charts when the chat had few dashboards.
  let allWidgets = widgets;
  if (widgets.length < 4) {
    const { widgets: aggWidgets } = await gatherAggregates();
    const seen = new Set(allWidgets.map((w) => w.id).filter(Boolean));
    for (const w of aggWidgets) {
      if (w.id && !seen.has(w.id)) {
        allWidgets.push(w);
        seen.add(w.id);
      }
    }
    allWidgets = pickWidgetsForAudience(allWidgets, audience);
  }

  const template = AUDIENCE_TEMPLATES[audience];
  const available = allWidgets.map((w) => ({
    id: w.id,
    kind: w.kind,
    title: "title" in w ? w.title : w.label,
  }));

  const { object } = await generateObject({
    model: anthropic(REPORT_MODEL),
    schema: reportNarrative,
    prompt:
      `Write a Lifechanger impact report grounded ONLY in the analyst conversation below.\n` +
      `Do NOT invent numbers, schools, or quotes that are not supported by the chat. ` +
      `If a metric was not discussed, you may reference program-wide charts provided but say so clearly.\n\n` +
      `${AUDIENCE_GUIDANCE[audience]}\n\n` +
      `${templateSectionPrompt(audience)}\n\n` +
      `Suggested title: "${template.reportTitle}"\n` +
      `Suggested subtitle: "${template.subtitle}"\n\n` +
      `Include executiveSummary (2-3 sentences) and keyTakeaways (3-5 bullets) for this audience.\n\n` +
      `De-identification: never use student names; only use quotes listed below; ` +
      `equity dimensions only as aggregates already stated in the chat.\n\n` +
      `Chat title: "${chat.title}"\n\n` +
      `--- Conversation transcript ---\n${ctx.transcript}\n\n` +
      `--- Assistant findings (structured) ---\n${JSON.stringify(ctx.assistantInsights, null, 2)}\n\n` +
      `--- Questions the staff explored ---\n${JSON.stringify(ctx.userQuestions, null, 2)}\n\n` +
      `--- Quotes you may use verbatim (from the chat only) ---\n` +
      `${JSON.stringify(ctx.quotes, null, 2)}\n\n` +
      `--- Charts available (reference by id in section.widgetIds) ---\n` +
      `${JSON.stringify(available, null, 2)}\n\n` +
      `Follow the section blueprint order. Each section needs 1-2 short paragraphs. ` +
      `Assign widgetIds that match the section story. Include student voices section with quotes when available.`,
  });

  const id = `rpt_${Math.random().toString(36).slice(2, 10)}`;
  const spec: ReportSpec = {
    ...object,
    audience,
    generatedAt: new Date().toISOString(),
    widgets: allWidgets,
    quotes: ctx.quotes.length ? ctx.quotes : [],
    sourceChatId: chatId,
  };
  await db.insert(reports).values({ id, audience, spec: spec as object });

  return NextResponse.json({ id });
}

import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
  type ModelMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { CHAT_MODEL } from "@/lib/ai/models";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { chatTools } from "@/lib/ai/tools";
import { saveMessages, saveDashboards } from "@/lib/db/chat-store";
import { lastUserText, loadDemoContext, demoSystemContext } from "@/lib/chat/demo-responses";
import { dedupeMessagesById } from "@/lib/chat/dedupe-messages";

export const maxDuration = 60;

type ActiveDashboard = {
  title: string;
  filters?: Record<string, string[]>;
  spec?: { widgets?: unknown[] };
};

export async function POST(req: Request) {
  const json = await req.json();
  const messages: UIMessage[] = dedupeMessagesById(json.messages ?? []);
  const chatId: string | undefined = json.chatId ?? json.id;
  const activeDashboard: ActiveDashboard | undefined = json.activeDashboard;

  if (!messages.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  // Persist user turns immediately so history survives navigation mid-stream.
  if (chatId) {
    try {
      await saveMessages(chatId, messages);
    } catch (e) {
      console.error("POST /api/chat saveMessages (pre-stream)", e);
    }
  }

  const systemMessage: ModelMessage = {
    role: "system",
    content: SYSTEM_PROMPT,
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  };

  const contextMessages: ModelMessage[] = [];

  const userText = lastUserText(messages);
  const demo = await loadDemoContext(userText).catch(() => null);
  if (demo) {
    contextMessages.push({
      role: "system",
      content: demoSystemContext(demo),
    });
  }

  if (activeDashboard) {
    contextMessages.push({
      role: "system",
      content:
        `The user is currently viewing this dashboard on screen. ` +
        `Title: "${activeDashboard.title}". ` +
        `Active client-side filters: ${JSON.stringify(activeDashboard.filters ?? {})}. ` +
        `Widgets and data: ${JSON.stringify(activeDashboard.spec?.widgets ?? [])}. ` +
        `For follow-ups like "why is that low?", "as a line chart", or "just metro", reason about ` +
        `THIS view and respect the active filters. If the user asks for a refinement, call ` +
        `make_dashboard again to append a new dashboard block.`,
    });
  }

  const result = streamText({
    model: anthropic(CHAT_MODEL),
    messages: [systemMessage, ...contextMessages, ...(await convertToModelMessages(messages))],
    tools: chatTools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // Assign a stable id to the assistant reply. Without this, the response
    // message has an empty id (the last original message is a user message),
    // so it gets dropped/collides on save and replies never persist.
    generateMessageId: () => crypto.randomUUID(),
    onFinish: async ({ messages: finalMessages }) => {
      if (chatId) {
        try {
          await saveMessages(chatId, finalMessages);
          await saveDashboards(chatId, finalMessages);
        } catch (e) {
          console.error("POST /api/chat saveMessages (onFinish)", e);
        }
      }
    },
  });
}

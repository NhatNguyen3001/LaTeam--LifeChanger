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

export const maxDuration = 60;

type ActiveDashboard = {
  title: string;
  filters?: Record<string, string[]>;
  spec?: { widgets?: unknown[] };
};

export async function POST(req: Request) {
  const {
    messages,
    chatId,
    activeDashboard,
  }: { messages: UIMessage[]; chatId?: string; activeDashboard?: ActiveDashboard } =
    await req.json();

  const systemMessage: ModelMessage = {
    role: "system",
    content: SYSTEM_PROMPT,
    // Cache the (static) system prompt + tool definitions across turns.
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  };

  // "Active dashboard context": tell the model what the user is actually looking at,
  // including their current client-side filter selection, so follow-ups reason about it.
  const contextMessages: ModelMessage[] = [];
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
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      if (chatId) {
        await saveMessages(chatId, finalMessages);
        await saveDashboards(chatId, finalMessages);
      }
    },
  });
}

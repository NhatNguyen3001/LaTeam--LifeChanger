import type { UIMessage } from "ai";

/** Keep first occurrence — stable order for React keys and DB saves. */
export function dedupeMessagesById(messages: UIMessage[]): UIMessage[] {
  const seen = new Set<string>();
  const out: UIMessage[] = [];
  for (const m of messages) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

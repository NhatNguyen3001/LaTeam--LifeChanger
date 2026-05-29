import type { UIMessage } from "ai";

function normalizeOnePart(part: unknown): UIMessage["parts"][number] | null {
  if (!part || typeof part !== "object") return null;
  const p = part as Record<string, unknown>;
  const type = String(p.type ?? "");

  if (type === "text" || type === "reasoning") {
    const text =
      typeof p.text === "string"
        ? p.text
        : typeof p.content === "string"
          ? p.content
          : "";
    if (text.trim()) return { type: "text", text: text.trim() };
    return null;
  }

  if (type.startsWith("tool-") || type === "step-start" || type === "file") {
    return part as UIMessage["parts"][number];
  }

  return null;
}

/** Normalize DB / SDK variants into UIMessage parts. */
export function normalizeParts(parts: unknown): UIMessage["parts"] {
  if (Array.isArray(parts)) {
    const out: UIMessage["parts"] = [];
    for (const part of parts) {
      const n = normalizeOnePart(part);
      if (n) out.push(n);
    }
    if (out.length > 0) return out;
  }

  if (parts && typeof parts === "object") {
    const obj = parts as Record<string, unknown>;
    if (Array.isArray(obj.parts)) {
      return normalizeParts(obj.parts);
    }
    if ("content" in obj) {
      const content = obj.content;
      if (typeof content === "string" && content.trim()) {
        return [{ type: "text", text: content.trim() }];
      }
    }
    if ("text" in obj && typeof obj.text === "string" && obj.text.trim()) {
      return [{ type: "text", text: obj.text.trim() }];
    }
  }

  if (typeof parts === "string" && parts.trim()) {
    return [{ type: "text", text: parts.trim() }];
  }

  return [];
}

export function textFromMessage(m: UIMessage): string {
  const legacy = m as UIMessage & { content?: string };
  if (typeof legacy.content === "string" && legacy.content.trim()) {
    return legacy.content.trim();
  }

  const texts: string[] = [];
  for (const part of m.parts ?? []) {
    const p = part as Record<string, unknown>;
    if (p.type === "text" || p.type === "reasoning") {
      const t =
        typeof p.text === "string"
          ? p.text
          : typeof p.content === "string"
            ? p.content
            : "";
      if (t.trim()) texts.push(t.trim());
    }
  }
  return texts.join("\n\n").trim();
}

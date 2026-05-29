"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Fix AI output that collapses markdown table rows onto one line (e.g. `| a || b |`). */
function normalizeMarkdown(content: string): string {
  return content.replace(/\|\|\s*/g, "|\n|");
}

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const normalized = normalizeMarkdown(content);

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h3: ({ children }) => (
            <h3 className="lc-heading mt-3 mb-1.5 text-sm">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="lc-heading mt-2 mb-1 text-xs tracking-[0.08em]">{children}</h4>
          ),
          code: ({ children }) => (
            <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-foreground/30 pl-3 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-foreground bg-white">
              <table className="w-full min-w-[16rem] border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-foreground/20 bg-primary/50">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-foreground/10 last:border-b-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="lc-heading px-3 py-2 text-left text-[10px] tracking-[0.08em]">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-3 py-2">{children}</td>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Ask in plain English…",
  initialValue = "",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-card focus-within:border-ring/60 relative flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-colors"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        className="max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-60"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || value.trim().length === 0}
        className="size-9 shrink-0 rounded-xl"
      >
        <ArrowUp className="size-4" />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}

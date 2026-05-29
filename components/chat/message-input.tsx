"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Ask in plain English about workshops, schools, or feedback…",
  initialValue = "",
  variant = "default",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  variant?: "default" | "home";
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
      className={cn(
        "relative flex items-end gap-2 p-2 transition-transform",
        variant === "home"
          ? "lc-brown-card rounded-full pr-2 pl-5"
          : cn(
              "lc-offset-card rounded-2xl border-2 border-lc-tan bg-card",
              "focus-within:border-foreground focus-within:shadow-[3px_3px_0_0_var(--lc-tan)]",
            ),
        disabled && "opacity-70",
      )}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        className={cn(
          "max-h-48 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none disabled:cursor-not-allowed",
          variant === "home" ? "placeholder:text-foreground/50 px-0" : "placeholder:text-muted-foreground/70 px-2",
        )}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || value.trim().length === 0}
        className={cn(
          "size-10 shrink-0",
          variant === "home" ? "rounded-full" : "rounded-xl",
        )}
      >
        <ArrowUp className="size-4" />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}

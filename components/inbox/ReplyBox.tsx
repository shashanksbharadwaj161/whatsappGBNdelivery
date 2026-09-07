"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ReplyBox({ conversationId, withinSessionWindow }: { conversationId: string; withinSessionWindow: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateParam, setTemplateParam] = useState("");
  const [useTemplate, setUseTemplate] = useState(!withinSessionWindow);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (useTemplate && !templateName.trim()) return;
    if (!useTemplate && !text.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            useTemplate
              ? { conversationId, mode: "template", templateName: templateName.trim(), bodyParams: templateParam ? [templateParam] : [] }
              : { conversationId, mode: "session", text }
          ),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Message failed to send");
        }
        setText("");
        setTemplateParam("");
        router.refresh();
      } catch {
        setError("Could not reach the server");
      }
    });
  }

  return (
    <div className="border-t border-border p-3">
      {!withinSessionWindow && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-hover">
          <span>More than 24 hours since the customer&rsquo;s last message — use an approved template.</span>
          <button
            type="button"
            className="ml-2 shrink-0 underline"
            onClick={() => setUseTemplate((v) => !v)}
          >
            {useTemplate ? "Type a free-form message instead" : "Use a template"}
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-status-cancelled">{error}</p>}

      {useTemplate ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Approved template name (e.g. order_confirmation)"
            disabled={pending}
          />
          <Input
            value={templateParam}
            onChange={(e) => setTemplateParam(e.target.value)}
            placeholder="Body parameter (optional)"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !templateName.trim()}>
            <Send size={16} />
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !text.trim()}>
            <Send size={16} />
          </Button>
        </form>
      )}
    </div>
  );
}

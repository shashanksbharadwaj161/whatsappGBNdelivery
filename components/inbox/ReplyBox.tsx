"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ReplyBox({ conversationId, withinSessionWindow }: { conversationId: string; withinSessionWindow: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, text }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Message failed to send");
        }
        setText("");
        router.refresh();
      } catch {
        setError("Could not reach the server");
      }
    });
  }

  return (
    <div className="border-t border-border p-3">
      {!withinSessionWindow && (
        <p className="mb-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-hover">
          More than 24 hours since the customer&rsquo;s last message — free-form replies may not deliver.
          Use an approved WhatsApp template instead (Phase 6).
        </p>
      )}
      {error && <p className="mb-2 text-xs text-status-cancelled">{error}</p>}
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
    </div>
  );
}

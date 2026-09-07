import { MessageCircle } from "lucide-react";

export default function InboxIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
      <MessageCircle size={32} className="opacity-50" />
      <p className="text-sm">Select a conversation to view the chat.</p>
    </div>
  );
}

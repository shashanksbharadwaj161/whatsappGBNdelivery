import { InboxFrame } from "@/components/inbox/InboxFrame";
import { ConversationList, type ConversationSummary } from "@/components/inbox/ConversationList";
import { listConversations } from "@/lib/services/conversations";

function previewFor(message: { type: string; textBody: string | null; locationName: string | null } | undefined) {
  if (!message) return "No messages yet";
  if (message.type === "TEXT") return message.textBody ?? "";
  if (message.type === "LOCATION") return `📍 ${message.locationName ?? "Shared a location"}`;
  return `[${message.type.toLowerCase()}]`;
}

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const conversations = await listConversations();

  const summaries: ConversationSummary[] = conversations.map((c) => ({
    id: c.id,
    displayName: c.customer?.name ?? c.displayName ?? c.waId,
    lastMessagePreview: previewFor(c.messages[0]),
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    unreadCount: c.unreadCount,
    status: c.status,
  }));

  return (
    <InboxFrame list={<ConversationList conversations={summaries} />}>{children}</InboxFrame>
  );
}

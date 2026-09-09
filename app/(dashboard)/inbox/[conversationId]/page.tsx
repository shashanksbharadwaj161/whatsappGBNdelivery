import Link from "next/link";
import { formatBusinessDateTime } from "@/lib/tz";
import { getConversationDetail, markConversationRead } from "@/lib/services/conversations";
import { ConversationActions } from "@/components/inbox/ConversationActions";
import { ReplyBox } from "@/components/inbox/ReplyBox";
import { isWithinSessionWindow } from "@/lib/whatsapp/session";
import { cn } from "@/lib/utils";
import { getOrNotFound } from "@/lib/notFoundGuard";

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const conversation = await getOrNotFound(() => getConversationDetail(conversationId));
  await markConversationRead(conversationId);

  const lastInbound = [...conversation.messages].reverse().find((m) => m.direction === "INBOUND");
  const withinSessionWindow = isWithinSessionWindow(lastInbound?.createdAt);

  const displayName = conversation.customer?.name ?? conversation.displayName ?? conversation.waId;
  const displayPhone = conversation.customer?.phone ?? `+${conversation.waId}`;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <Link href="/inbox" className="px-4 py-3 text-sm text-primary md:hidden">← All conversations</Link>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="font-medium text-ink">{displayName}</p>
          <p className="text-xs text-ink-muted">{displayPhone}</p>
        </div>
        <ConversationActions
          conversationId={conversation.id}
          customerId={conversation.customerId}
          customerName={displayName}
          customerPhone={displayPhone}
          status={conversation.status}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.map((message) => (
          <div key={message.id} className={cn("flex", message.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] break-words rounded-xl px-3 py-2 text-sm",
                message.direction === "OUTBOUND" ? "bg-primary text-white" : "bg-surface-alt text-ink"
              )}
            >
              {message.type === "TEXT" && <p className="whitespace-pre-wrap">{message.textBody}</p>}
              {message.type === "LOCATION" && (
                <p>
                  📍 {message.locationName ?? "Shared location"}
                  <br />
                  <span className="text-xs opacity-80">
                    {message.locationLatitude?.toFixed(5)}, {message.locationLongitude?.toFixed(5)}
                  </span>
                </p>
              )}
              {!["TEXT", "LOCATION"].includes(message.type) && (
                <p className="italic opacity-80">[{message.type.toLowerCase()} message]</p>
              )}
              {message.status === "FAILED" && (
                <p className="mt-1 text-xs text-status-cancelled">Failed to send{message.errorDetail ? `: ${message.errorDetail}` : ""}</p>
              )}
              <p className={cn("mt-1 text-[10px]", message.direction === "OUTBOUND" ? "text-white/70" : "text-ink-faint")}>
                {formatBusinessDateTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ReplyBox conversationId={conversation.id} withinSessionWindow={withinSessionWindow} />
    </div>
  );
}

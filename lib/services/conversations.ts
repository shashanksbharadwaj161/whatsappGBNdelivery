import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import type { NormalizedInboundMessage, NormalizedStatusUpdate } from "@/lib/whatsapp/webhook";
import type { ConversationStatus, MessageType } from "@prisma/client";

/**
 * Upserts the conversation + inserts the message idempotently (Meta
 * retries webhook deliveries at-least-once — waMessageId is unique).
 * Best-effort links to an existing Customer by phone; a WhatsApp lead
 * with no matching Customer is still fully usable from the Inbox.
 */
export async function recordInboundMessage(message: NormalizedInboundMessage) {
  const existingMessage = message.waMessageId
    ? await db.whatsappMessage.findUnique({ where: { waMessageId: message.waMessageId } })
    : null;
  if (existingMessage) return existingMessage;

  const matchingCustomer = await db.customer.findUnique({ where: { phone: `+${message.waId}` } });

  const conversation = await db.whatsappConversation.upsert({
    where: { waId: message.waId },
    update: {
      displayName: message.displayName ?? undefined,
      customerId: matchingCustomer?.id,
      lastMessageAt: message.timestamp,
      unreadCount: { increment: 1 },
    },
    create: {
      waId: message.waId,
      displayName: message.displayName,
      customerId: matchingCustomer?.id,
      lastMessageAt: message.timestamp,
      unreadCount: 1,
    },
  });

  return db.whatsappMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      type: message.type as MessageType,
      waMessageId: message.waMessageId,
      textBody: message.textBody,
      locationLatitude: message.locationLatitude,
      locationLongitude: message.locationLongitude,
      locationName: message.locationName,
      mediaId: message.mediaId,
      status: "DELIVERED",
      createdAt: message.timestamp,
    },
  });
}

export async function applyStatusUpdate(update: NormalizedStatusUpdate) {
  const message = await db.whatsappMessage.findUnique({ where: { waMessageId: update.waMessageId } });
  if (!message) return null;

  const updated = await db.whatsappMessage.update({
    where: { id: message.id },
    data: { status: update.status, errorDetail: update.errorDetail },
  });

  if (update.status === "FAILED") {
    await recordAudit({
      action: "WHATSAPP_MESSAGE_FAILED",
      entityType: "WhatsappMessage",
      entityId: message.id,
      actorType: "system",
      metadata: { reason: update.errorDetail },
    });
  }

  return updated;
}

export async function listConversations() {
  return db.whatsappConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function getConversationDetail(conversationId: string) {
  const conversation = await db.whatsappConversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: { include: { defaultAddress: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) throw new NotFoundError("Conversation not found");
  return conversation;
}

export async function markConversationRead(conversationId: string) {
  return db.whatsappConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

export async function setConversationStatus(conversationId: string, status: ConversationStatus) {
  return db.whatsappConversation.update({
    where: { id: conversationId },
    data: { status },
  });
}

export interface RecordOutboundMessageInput {
  conversationId: string;
  type: MessageType;
  textBody?: string;
  templateName?: string;
  waMessageId?: string;
  status: "SENT" | "FAILED";
  errorDetail?: string;
  sentByUserId?: string;
}

export async function recordOutboundMessage(input: RecordOutboundMessageInput) {
  const message = await db.whatsappMessage.create({
    data: {
      conversationId: input.conversationId,
      direction: "OUTBOUND",
      type: input.type,
      textBody: input.textBody,
      templateName: input.templateName,
      waMessageId: input.waMessageId,
      status: input.status,
      errorDetail: input.errorDetail,
      sentByUserId: input.sentByUserId,
    },
  });

  await db.whatsappConversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: new Date() },
  });

  if (input.status === "FAILED") {
    await recordAudit({
      action: "WHATSAPP_MESSAGE_FAILED",
      entityType: "WhatsappMessage",
      entityId: message.id,
      actorUserId: input.sentByUserId,
      metadata: { reason: input.errorDetail },
    });
  }

  return message;
}

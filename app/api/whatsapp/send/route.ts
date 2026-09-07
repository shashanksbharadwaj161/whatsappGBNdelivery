import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { sendSessionTextMessage } from "@/lib/whatsapp/client";
import { recordOutboundMessage } from "@/lib/services/conversations";

export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireRole(["OWNER"]);
  const body = await request.json();

  const conversationId = body.conversationId as string | undefined;
  const text = body.text as string | undefined;
  if (!conversationId || !text?.trim()) {
    throw new ValidationError("conversationId and text are required");
  }

  const conversation = await db.whatsappConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError("Conversation not found");

  const result = await sendSessionTextMessage(conversation.waId, text.trim());

  const message = await recordOutboundMessage({
    conversationId,
    type: "TEXT",
    textBody: text.trim(),
    waMessageId: result.ok ? result.waMessageId : undefined,
    status: result.ok ? "SENT" : "FAILED",
    errorDetail: result.ok ? undefined : result.error,
    sentByUserId: user.userId,
  });

  return NextResponse.json({ ok: result.ok, message, error: result.ok ? undefined : result.error });
});

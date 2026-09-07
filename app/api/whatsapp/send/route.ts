import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { sendSessionTextMessage, sendTemplateMessage } from "@/lib/whatsapp/client";
import { recordOutboundMessage } from "@/lib/services/conversations";

export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireRole(["OWNER"]);
  const body = await request.json();

  const conversationId = body.conversationId as string | undefined;
  const mode = (body.mode as "session" | "template" | undefined) ?? "session";
  if (!conversationId) throw new ValidationError("conversationId is required");

  const conversation = await db.whatsappConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError("Conversation not found");

  if (mode === "template") {
    const templateName = body.templateName as string | undefined;
    if (!templateName?.trim()) throw new ValidationError("templateName is required for a template send");
    const bodyParams = (body.bodyParams as string[] | undefined) ?? [];

    const result = await sendTemplateMessage(conversation.waId, templateName.trim(), body.languageCode, bodyParams);
    const message = await recordOutboundMessage({
      conversationId,
      type: "TEMPLATE",
      templateName: templateName.trim(),
      textBody: bodyParams.length ? bodyParams.join(" · ") : undefined,
      waMessageId: result.ok ? result.waMessageId : undefined,
      status: result.ok ? "SENT" : "FAILED",
      errorDetail: result.ok ? undefined : result.error,
      sentByUserId: user.userId,
    });
    return NextResponse.json({ ok: result.ok, message, error: result.ok ? undefined : result.error });
  }

  const text = body.text as string | undefined;
  if (!text?.trim()) throw new ValidationError("text is required for a session send");

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

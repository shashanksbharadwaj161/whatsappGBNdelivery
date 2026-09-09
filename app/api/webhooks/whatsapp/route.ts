import { automateInbound } from "@/lib/services/whatsapp-automation";
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, normalizeInboundMessages, normalizeStatusUpdates, type WebhookPayload } from "@/lib/whatsapp/webhook";
import { recordInboundMessage, applyStatusUpdate } from "@/lib/services/conversations";

/** Meta's webhook subscription verification handshake. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (process.env.WHATSAPP_VERIFY_TOKEN && mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/** Persist each item idempotently; return 503 on storage failure so Meta retries. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("WhatsApp webhook: signature verification failed");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Ack anyway — a malformed body isn't something a Meta retry will fix.
    return NextResponse.json({ received: true });
  }

  let failed = false;
  const messages = normalizeInboundMessages(payload);
  for (const message of messages) {
    try {
      const saved = await recordInboundMessage(message);
      await automateInbound(saved.id);
    } catch (error) {
      failed = true;
      console.error("WhatsApp webhook: failed to record inbound message", message.waMessageId, error);
    }
  }

  const statuses = normalizeStatusUpdates(payload);
  for (const status of statuses) {
    try {
      await applyStatusUpdate(status);
    } catch (error) {
      failed = true;
      console.error("WhatsApp webhook: failed to apply status update", status.waMessageId, error);
    }
  }

  return NextResponse.json({ received: !failed }, { status: failed ? 503 : 200 });
}

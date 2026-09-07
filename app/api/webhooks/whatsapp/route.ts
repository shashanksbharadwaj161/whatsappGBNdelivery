import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, normalizeInboundMessages, normalizeStatusUpdates, type WebhookPayload } from "@/lib/whatsapp/webhook";
import { recordInboundMessage, applyStatusUpdate } from "@/lib/services/conversations";

/** Meta's webhook subscription verification handshake. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Inbound message/status webhook. Always acks 200 once the signature is
 * verified — Meta retries aggressively on non-2xx, and a single bad
 * message in a batch must not fail the rest, so each item is processed
 * in its own try/catch. Never loses an order-relevant message silently:
 * failures here are logged server-side for follow-up.
 */
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

  const messages = normalizeInboundMessages(payload);
  for (const message of messages) {
    try {
      await recordInboundMessage(message);
    } catch (error) {
      console.error("WhatsApp webhook: failed to record inbound message", message.waMessageId, error);
    }
  }

  const statuses = normalizeStatusUpdates(payload);
  for (const status of statuses) {
    try {
      await applyStatusUpdate(status);
    } catch (error) {
      console.error("WhatsApp webhook: failed to apply status update", status.waMessageId, error);
    }
  }

  return NextResponse.json({ received: true });
}

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw request body
 * using META_APP_SECRET. Must run before any JSON.parse of the body.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}

// ---------- Inbound payload shapes (subset of Meta's webhook body) ----------

interface WhatsAppTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text";
  text: { body: string };
}

interface WhatsAppLocationMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "location";
  location: { latitude: number; longitude: number; name?: string; address?: string };
}

interface WhatsAppOtherMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "image" | "document" | "audio" | "video" | "sticker" | string;
  image?: { id: string };
  document?: { id: string };
  audio?: { id: string };
  video?: { id: string };
  sticker?: { id: string };
}

type WhatsAppInboundMessage = WhatsAppTextMessage | WhatsAppLocationMessage | WhatsAppOtherMessage;

interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  errors?: Array<{ message: string }>;
}

export interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
        messages?: WhatsAppInboundMessage[];
        statuses?: WhatsAppStatus[];
      };
    }>;
  }>;
}

export interface NormalizedInboundMessage {
  waId: string;
  displayName: string | null;
  waMessageId: string;
  timestamp: Date;
  type: "TEXT" | "LOCATION" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "STICKER" | "UNKNOWN";
  textBody?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  locationName?: string;
  mediaId?: string;
}

export interface NormalizedStatusUpdate {
  waMessageId: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  errorDetail?: string;
}

const MESSAGE_TYPE_MAP: Record<string, NormalizedInboundMessage["type"]> = {
  text: "TEXT",
  location: "LOCATION",
  image: "IMAGE",
  document: "DOCUMENT",
  audio: "AUDIO",
  video: "VIDEO",
  sticker: "STICKER",
};

export function normalizeInboundMessages(payload: WebhookPayload): NormalizedInboundMessage[] {
  const results: NormalizedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const nameByWaId = new Map(
        (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null])
      );

      for (const message of value.messages ?? []) {
        const base = {
          waId: message.from,
          displayName: nameByWaId.get(message.from) ?? null,
          waMessageId: message.id,
          timestamp: new Date(Number(message.timestamp) * 1000),
        };

        if (message.type === "text") {
          results.push({ ...base, type: "TEXT", textBody: (message as WhatsAppTextMessage).text.body });
        } else if (message.type === "location") {
          const loc = (message as WhatsAppLocationMessage).location;
          results.push({
            ...base,
            type: "LOCATION",
            locationLatitude: loc.latitude,
            locationLongitude: loc.longitude,
            locationName: loc.name ?? loc.address,
          });
        } else {
          const other = message as WhatsAppOtherMessage;
          const mediaId =
            other.image?.id ?? other.document?.id ?? other.audio?.id ?? other.video?.id ?? other.sticker?.id;
          results.push({
            ...base,
            type: MESSAGE_TYPE_MAP[message.type] ?? "UNKNOWN",
            mediaId,
          });
        }
      }
    }
  }

  return results;
}

export function normalizeStatusUpdates(payload: WebhookPayload): NormalizedStatusUpdate[] {
  const results: NormalizedStatusUpdate[] = [];
  const statusMap: Record<string, NormalizedStatusUpdate["status"]> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const status of change.value.statuses ?? []) {
        results.push({
          waMessageId: status.id,
          status: statusMap[status.status] ?? "SENT",
          errorDetail: status.errors?.map((e) => e.message).join("; "),
        });
      }
    }
  }

  return results;
}

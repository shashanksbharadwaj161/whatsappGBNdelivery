const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";

export type SendResult =
  | { ok: true; waMessageId: string }
  | { ok: false; error: string };

function graphUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  return `${process.env.WHATSAPP_PROVIDER === "kapso" ? "https://api.kapso.ai/meta/whatsapp" : "https://graph.facebook.com"}/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

async function callGraphApi(body: Record<string, unknown>): Promise<SendResult> {
  const kapso=process.env.WHATSAPP_PROVIDER === "kapso";
  const token = kapso ? process.env.KAPSO_API_KEY : process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, error: kapso ? "KAPSO_API_KEY is not configured" : "WHATSAPP_ACCESS_TOKEN is not configured" };
  }

  try {
    const res = await fetch(graphUrl(), {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(kapso ? {"X-API-Key":token} : {Authorization: `Bearer ${token}`}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.error?.message ?? `WhatsApp API returned ${res.status}`;
      return { ok: false, error: message };
    }

    const waMessageId = data?.messages?.[0]?.id;
    if (!waMessageId) {
      return { ok: false, error: "WhatsApp API response missing message id" };
    }

    return { ok: true, waMessageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error calling WhatsApp API" };
  }
}

/**
 * Free-form text reply. Only deliverable inside the 24h customer-service
 * window after the customer's last inbound message — the Inbox UI warns
 * when that window has elapsed and a template should be used instead.
 */
export function sendSessionTextMessage(toWaId: string, body: string): Promise<SendResult> {
  return callGraphApi({
    to: toWaId,
    type: "text",
    text: { body },
  });
}

/**
 * Pre-approved template message — the only way to message a customer
 * outside the 24h session window, or to proactively reach a new lead.
 */
export function sendTemplateMessage(
  toWaId: string,
  templateName: string,
  languageCode = "en_US",
  bodyParams: string[] = []
): Promise<SendResult> {
  return callGraphApi({
    to: toWaId,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParams.length
        ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
        : undefined,
    },
  });
}

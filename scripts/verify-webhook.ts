/**
 * Sends one simulated Meta WhatsApp webhook payload (matching the real
 * shape) to a running dev server, signed with META_APP_SECRET, so the
 * signature-verification + inbound-message path can be checked without
 * a live Meta account. Companion to scripts/traceability-gate.ts.
 *
 * Usage: npm run dev (in one terminal), then:
 *   npx tsx scripts/verify-webhook.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createHmac } from "crypto";

const BASE_URL = process.env.VERIFY_WEBHOOK_BASE_URL ?? "http://localhost:3000";

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            contacts: [{ profile: { name: "Traceability Test Lead" }, wa_id: "919845077777" }],
            messages: [
              {
                from: "919845077777",
                id: "wamid.TRACEABILITY001",
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: "Hi, I want 1 litre milk daily. I'm near Abbigere, Bengaluru." },
              },
            ],
          },
        },
      ],
    },
  ],
};

async function main() {
  const body = JSON.stringify(payload);
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("META_APP_SECRET is not set");

  const signature = "sha256=" + createHmac("sha256", appSecret).update(body, "utf8").digest("hex");

  const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
    body,
  });

  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

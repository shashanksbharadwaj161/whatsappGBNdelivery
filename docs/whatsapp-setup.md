# WhatsApp Cloud API setup

The app supports Meta's official WhatsApp Business Platform directly or
through Kapso. Production intends to use Kapso Coexistence to keep
**+91 63621 34868** working in the WhatsApp Business phone app.

## Kapso Coexistence

Complete **Connect WhatsApp Business App** in Kapso and approve the
connection on the business phone. Do not delete or deregister the phone
app account. Confirm the connected number is online before enabling intake.

Set these server-only Render variables using secure dashboard fields:

- `WHATSAPP_PROVIDER=kapso`
- `WHATSAPP_PHONE_NUMBER_ID`: the actual connected phone ID from Kapso
- `KAPSO_API_KEY`: the project API key
- `KAPSO_WEBHOOK_SECRET`: a randomly generated webhook signing secret
- `WHATSAPP_AUTOMATION_ENABLED=true`

Create a v2 **unbuffered** webhook in Kapso with the same signing secret,
pointing to `https://gbn-delivery.onrender.com/api/webhooks/kapso`.
Subscribe to `whatsapp.message.received`, `whatsapp.message.sent`,
`whatsapp.message.delivered`, `whatsapp.message.read`, and
`whatsapp.message.failed`. Buffered batch payloads are not supported.

The handler validates `X-Webhook-Signature` against the raw request body,
filters by the configured phone ID, and ignores historical imports and
outbound phone-app echoes. Direct Meta POST intake is disabled when Kapso
is selected, avoiding duplicate processing through two providers.

Verify a real inbound `ORDER`, automated reply, location pin, confirmed
order, automatic delivery round, and driver GPS optimization before
declaring the integration live. Configuration alone does not verify delivery.

The following sections describe the alternative direct Meta connection.

## 1. Create a Meta Developer account and app

1. Go to [developers.facebook.com](https://developers.facebook.com) and
   log in / sign up.
2. **My Apps → Create App**. Choose the **Business** app type.
3. In the app dashboard, find **WhatsApp** under "Add products to your
   app" and click **Set up**.

## 2. Register the business phone number

1. In **WhatsApp → API Setup**, you'll see a Meta test number by
   default — for production, add and verify the real number
   (+91 63621 34868) instead: **WhatsApp → API Setup → Add phone
   number**, following Meta's verification flow (SMS/voice OTP).
   - To preserve an existing WhatsApp Business phone app account, use
     Coexistence onboarding above instead of deregistering it.
2. Note down, from the API Setup page:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → `WHATSAPP_BUSINESS_ACCOUNT_ID`

## 3. Generate a permanent access token

The token shown by default on the API Setup page expires in 24 hours —
fine for a first test, not for production.

1. **Business Settings → Users → System Users → Add** — create a system
   user (e.g. "gbn-app") with only the required app and messaging access.
2. Assign it the WhatsApp app with `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions.
3. **Generate token** for that system user, selecting those two
   permissions and **no expiration**.
4. Copy it into `.env.local` as `WHATSAPP_ACCESS_TOKEN`.

## 4. Get the App Secret

**App Settings → Basic → App Secret → Show.** Copy into
`META_APP_SECRET`. The webhook handler uses this to verify every
inbound request is genuinely from Meta (HMAC-SHA256 over the raw body,
compared against the `X-Hub-Signature-256` header) — requests that
don't match are rejected before any data is touched.

## 5. Choose a verify token

`WHATSAPP_VERIFY_TOKEN` is any string you make up (e.g. a random
32-character value). You'll enter the same value in both `.env.local`
and the Meta webhook config in the next step — Meta uses it once, during
setup, to confirm you control the endpoint.

## 6. Configure the webhook

1. Deploy the app first (see `docs/deployment.md`) so you have a public
   HTTPS URL — Meta requires a real, publicly reachable HTTPS endpoint;
   `localhost` will not work here even for testing (use a tunnel like
   ngrok if you need to test locally against Meta's real servers).
2. **WhatsApp → Configuration → Webhook → Edit.**
   - **Callback URL**: `https://<your-domain>/api/webhooks/whatsapp`
   - **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN`.
3. Click **Verify and Save** — Meta calls your endpoint with a
   `hub.challenge` and expects it echoed back; the app's
   `GET /api/webhooks/whatsapp` handler does this automatically.
4. Under **Webhook fields**, subscribe to **messages** (this covers
   inbound text/location/media messages and outbound delivery-status
   updates).

## 7. Test it

Send a WhatsApp message to +91 63621 34868 from your own phone — it
should appear in the app's **Inbox** within a couple of seconds.

To test the webhook without a real Meta account (e.g. in a sandbox
without live credentials), see `scripts/verify-webhook.ts` — it POSTs a
correctly-signed, Meta-shaped payload directly to a running dev server.

## 8. Session window and templates

WhatsApp only allows free-form replies within **24 hours** of the
customer's last message. Outside that window, only pre-approved
**message templates** can be sent. The Inbox reply box detects this and
switches to a template form automatically — approve templates you plan
to use (e.g. an order-confirmation or delivery-reminder template) under
**WhatsApp → Message Templates** in the Meta dashboard first.

## 9. What happens without real credentials

Every part of the WhatsApp integration is built against the real Graph
API — there's no mocked or fake mode. Without a valid
`WHATSAPP_ACCESS_TOKEN`, outbound sends simply fail (a real 401/403 from
Meta), and that failure is recorded on the message (visible in the
Inbox) and in the audit log rather than being silently dropped or faked
as successful.

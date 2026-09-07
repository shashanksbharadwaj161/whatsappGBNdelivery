/**
 * Best-effort normalization of an Indian phone number to E.164. WhatsApp
 * always gives us digits-only "from" ids already close to E.164; this
 * mainly handles admin-typed numbers (with spaces, leading 0, etc).
 */
export function normalizePhoneToE164(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  const hadPlus = digits.startsWith("+");
  const stripped = digits.replace(/^\+/, "").replace(/^0+/, "");

  if (hadPlus) return `+${stripped}`;
  if (stripped.length === 10) return `+91${stripped}`;
  if (stripped.length === 12 && stripped.startsWith("91")) return `+${stripped}`;
  return `+${stripped}`;
}

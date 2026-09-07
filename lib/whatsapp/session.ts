const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether a free-form session reply is still deliverable (within 24h of the customer's last message). */
export function isWithinSessionWindow(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < SESSION_WINDOW_MS;
}

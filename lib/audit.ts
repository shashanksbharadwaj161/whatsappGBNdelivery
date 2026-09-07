import { db } from "@/lib/db";
import type { AuditAction } from "@prisma/client";

/**
 * Records who did what to which entity. Metadata must only ever contain
 * ids and changed field names — never raw address text, phone numbers,
 * or other PII copied wholesale into the log.
 */
export async function recordAudit(params: {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  actorType?: "admin" | "system" | "driver";
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      actorUserId: params.actorUserId,
      actorType: params.actorType ?? "admin",
      metadata: params.metadata as never,
    },
  });
}

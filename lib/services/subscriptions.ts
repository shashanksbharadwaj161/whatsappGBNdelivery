import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { businessDateOnlyToDate, addDaysToBusinessDateString, todayBusinessDateString } from "@/lib/tz";
import type { DeliveryWindow, MilkSize, SubscriptionFrequency } from "@prisma/client";

export interface CreateSubscriptionInput {
  customerId: string;
  addressId: string;
  milkSize: MilkSize;
  customQuantityLiters?: number | null;
  quantity: number;
  frequency: SubscriptionFrequency;
  startDate: string;
  endDate?: string | null;
  deliveryWindow: DeliveryWindow;
  notes?: string | null;
  actorUserId?: string;
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const subscription = await db.subscription.create({
    data: {
      customerId: input.customerId,
      addressId: input.addressId,
      milkSize: input.milkSize,
      customQuantityLiters: input.customQuantityLiters,
      quantity: input.quantity,
      frequency: input.frequency,
      startDate: businessDateOnlyToDate(input.startDate),
      endDate: input.endDate ? businessDateOnlyToDate(input.endDate) : null,
      deliveryWindow: input.deliveryWindow,
      notes: input.notes,
      status: "ACTIVE",
    },
  });

  await recordAudit({
    action: "SUBSCRIPTION_CREATED",
    entityType: "Subscription",
    entityId: subscription.id,
    actorUserId: input.actorUserId,
  });

  return subscription;
}

async function setStatus(
  subscriptionId: string,
  status: "PAUSED" | "ACTIVE" | "CANCELLED",
  action: "SUBSCRIPTION_PAUSED" | "SUBSCRIPTION_RESUMED" | "SUBSCRIPTION_CANCELLED",
  actorUserId?: string
) {
  const existing = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!existing) throw new NotFoundError("Subscription not found");
  if (existing.status === "CANCELLED") throw new ConflictError("This subscription is already cancelled");

  const updated = await db.subscription.update({ where: { id: subscriptionId }, data: { status } });
  await recordAudit({ action, entityType: "Subscription", entityId: subscriptionId, actorUserId });
  return updated;
}

export const pauseSubscription = (id: string, actorUserId?: string) =>
  setStatus(id, "PAUSED", "SUBSCRIPTION_PAUSED", actorUserId);
export const resumeSubscription = (id: string, actorUserId?: string) =>
  setStatus(id, "ACTIVE", "SUBSCRIPTION_RESUMED", actorUserId);
export const cancelSubscription = (id: string, actorUserId?: string) =>
  setStatus(id, "CANCELLED", "SUBSCRIPTION_CANCELLED", actorUserId);

export async function skipTomorrow(subscriptionId: string, actorUserId?: string) {
  const subscription = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new NotFoundError("Subscription not found");

  const tomorrow = addDaysToBusinessDateString(todayBusinessDateString(), 1);
  const skip = await db.subscriptionSkip.upsert({
    where: { subscriptionId_date: { subscriptionId, date: businessDateOnlyToDate(tomorrow) } },
    update: {},
    create: { subscriptionId, date: businessDateOnlyToDate(tomorrow) },
  });

  await recordAudit({
    action: "SUBSCRIPTION_SKIPPED",
    entityType: "Subscription",
    entityId: subscriptionId,
    actorUserId,
    metadata: { date: tomorrow },
  });

  return skip;
}

export async function listSubscriptionsForCustomer(customerId: string) {
  return db.subscription.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { address: true, skips: { orderBy: { date: "desc" }, take: 5 } },
  });
}

import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { computeOrderPricing } from "@/lib/pricing";
import { hasCoordinates } from "@/lib/services/addresses";
import { businessDateOnlyToDate } from "@/lib/tz";

function isDue(subscription: { frequency: string; startDate: Date }, date: Date): boolean {
  if (subscription.frequency === "DAILY") return true;
  if (subscription.frequency === "ALTERNATE_DAYS") {
    const daysSinceStart = Math.round((date.getTime() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceStart % 2 === 0;
  }
  // CUSTOM frequency has no generic rule for MVP — admin creates those orders manually.
  return false;
}

export interface GenerationResult {
  created: number;
  skippedAlreadyExists: number;
  skippedByRequest: number;
  skippedNoCoordinates: number;
  errors: Array<{ subscriptionId: string; message: string }>;
}

/**
 * Generates today's orders from active subscriptions. Idempotent — safe
 * to re-run for the same date (the unique constraint on
 * [subscriptionId, deliveryDate] is the backstop behind the upfront
 * existence check here).
 */
export async function generateDailyOrders(dateString: string): Promise<GenerationResult> {
  const date = businessDateOnlyToDate(dateString);

  const subscriptions = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    include: { customer: true, address: true, skips: { where: { date } } },
  });

  const result: GenerationResult = { created: 0, skippedAlreadyExists: 0, skippedByRequest: 0, skippedNoCoordinates: 0, errors: [] };

  for (const subscription of subscriptions) {
    try {
      if (subscription.skips.length > 0) {
        result.skippedByRequest++;
        continue;
      }
      if (!isDue(subscription, date)) continue;

      const existing = await db.order.findUnique({
        where: { subscriptionId_deliveryDate: { subscriptionId: subscription.id, deliveryDate: date } },
      });
      if (existing) {
        result.skippedAlreadyExists++;
        continue;
      }

      if (!hasCoordinates(subscription.address)) {
        result.skippedNoCoordinates++;
        continue;
      }

      const pricing = computeOrderPricing({
        milkSize: subscription.milkSize,
        customQuantityLiters: subscription.customQuantityLiters,
        quantity: subscription.quantity,
      });

      const order = await db.order.create({
        data: {
          customerId: subscription.customerId,
          addressId: subscription.addressId,
          subscriptionId: subscription.id,
          milkSize: subscription.milkSize,
          customQuantityLiters: subscription.customQuantityLiters,
          quantity: subscription.quantity,
          orderType: "DAILY_SUBSCRIPTION",
          source: "SUBSCRIPTION",
          deliveryDate: date,
          deliveryWindow: subscription.deliveryWindow,
          unitPrice: pricing.unitPrice,
          deliveryFee: pricing.deliveryFee,
          subtotal: pricing.subtotal,
          total: pricing.total,
          paymentStatus: "PENDING",
          status: "CONFIRMED", // subscription address is already known-good
        },
      });

      await recordAudit({
        action: "ORDER_CREATED",
        entityType: "Order",
        entityId: order.id,
        actorType: "system",
        metadata: { source: "SUBSCRIPTION", subscriptionId: subscription.id, deliveryDate: dateString },
      });

      result.created++;
    } catch (error) {
      result.errors.push({ subscriptionId: subscription.id, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return result;
}

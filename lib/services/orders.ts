import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { computeOrderPricing } from "@/lib/pricing";
import { hasCoordinates } from "@/lib/services/addresses";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { businessDateOnlyToDate } from "@/lib/tz";
import type { DeliveryWindow, MilkSize, OrderSource, OrderStatus, OrderType, PaymentStatus } from "@prisma/client";

export interface CreateOrderInput {
  customerId: string;
  addressId: string;
  conversationId?: string | null;
  subscriptionId?: string | null;
  milkSize: MilkSize;
  customQuantityLiters?: number | null;
  quantity: number;
  orderType: OrderType;
  source: OrderSource;
  sourceCampaign?: string | null;
  sourceAd?: string | null;
  sourceAdset?: string | null;
  deliveryDate: string; // yyyy-MM-dd, business (Asia/Kolkata) calendar date
  deliveryWindow: DeliveryWindow;
  customWindowStart?: string | null;
  customWindowEnd?: string | null;
  deliveryNotes?: string | null;
  googleMapsUrl?: string | null;
  paymentStatus?: PaymentStatus;
  createdByUserId?: string;
}

export async function createOrder(input: CreateOrderInput) {
  const pricing = computeOrderPricing({
    milkSize: input.milkSize,
    customQuantityLiters: input.customQuantityLiters,
    quantity: input.quantity,
  });

  if (input.subscriptionId) {
    const dup = await db.order.findUnique({
      where: {
        subscriptionId_deliveryDate: {
          subscriptionId: input.subscriptionId,
          deliveryDate: businessDateOnlyToDate(input.deliveryDate),
        },
      },
    });
    if (dup) {
      throw new ConflictError("An order already exists for this subscription on this date");
    }
  }

  const order = await db.order.create({
    data: {
      customerId: input.customerId,
      addressId: input.addressId,
      conversationId: input.conversationId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      milkSize: input.milkSize,
      customQuantityLiters: input.customQuantityLiters ?? null,
      quantity: input.quantity,
      orderType: input.orderType,
      source: input.source,
      sourceCampaign: input.sourceCampaign ?? null,
      sourceAd: input.sourceAd ?? null,
      sourceAdset: input.sourceAdset ?? null,
      deliveryDate: businessDateOnlyToDate(input.deliveryDate),
      deliveryWindow: input.deliveryWindow,
      customWindowStart: input.customWindowStart ?? null,
      customWindowEnd: input.customWindowEnd ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      googleMapsUrl: input.googleMapsUrl ?? null,
      unitPrice: pricing.unitPrice,
      deliveryFee: pricing.deliveryFee,
      subtotal: pricing.subtotal,
      total: pricing.total,
      paymentStatus: input.paymentStatus ?? "PENDING",
      status: "PENDING",
      createdByUserId: input.createdByUserId,
    },
    include: { customer: true, address: true },
  });

  await recordAudit({
    action: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    actorUserId: input.createdByUserId,
    metadata: { source: input.source, deliveryDate: input.deliveryDate },
  });

  return order;
}

/**
 * The only place an Order is allowed to move to CONFIRMED. Enforces the
 * application-level guarantee that Address coordinates are nullable at
 * the schema level but required before an order can be routed.
 */
export async function confirmOrder(orderId: string, actorUserId?: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { address: true } });
  if (!order) throw new NotFoundError("Order not found");

  if (!hasCoordinates(order.address)) {
    throw new ValidationError(
      "This order's address has no coordinates yet — resolve or pin the location before confirming."
    );
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status: "CONFIRMED" },
  });

  await recordAudit({
    action: "ORDER_CONFIRMED",
    entityType: "Order",
    entityId: orderId,
    actorUserId,
  });

  return updated;
}

export async function cancelOrder(orderId: string, reason: string | undefined, actorUserId?: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order not found");
  if (order.status === "DELIVERED") {
    throw new ConflictError("Cannot cancel an order that has already been delivered");
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED", deliveryNotes: reason ? `${order.deliveryNotes ?? ""}\nCancelled: ${reason}`.trim() : order.deliveryNotes },
  });

  await recordAudit({
    action: "ORDER_CANCELLED",
    entityType: "Order",
    entityId: orderId,
    actorUserId,
    metadata: { reason },
  });

  return updated;
}

export interface UpdateOrderInput {
  milkSize?: MilkSize;
  customQuantityLiters?: number | null;
  quantity?: number;
  deliveryDate?: string;
  deliveryWindow?: DeliveryWindow;
  customWindowStart?: string | null;
  customWindowEnd?: string | null;
  deliveryNotes?: string | null;
  paymentStatus?: PaymentStatus;
  addressId?: string;
  actorUserId?: string;
}

export async function updateOrder(orderId: string, input: UpdateOrderInput) {
  const existing = await db.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new NotFoundError("Order not found");
  if (existing.status === "DELIVERED" || existing.status === "CANCELLED") {
    throw new ConflictError(`Cannot edit an order that is already ${existing.status.toLowerCase()}`);
  }

  const changedFields = Object.keys(input).filter(
    (k) => k !== "actorUserId" && (input as Record<string, unknown>)[k] !== undefined
  );

  let pricingPatch = {};
  if (input.milkSize || input.customQuantityLiters !== undefined || input.quantity !== undefined) {
    const pricing = computeOrderPricing({
      milkSize: input.milkSize ?? existing.milkSize,
      customQuantityLiters: input.customQuantityLiters ?? existing.customQuantityLiters,
      quantity: input.quantity ?? existing.quantity,
      deliveryFee: Number(existing.deliveryFee),
    });
    pricingPatch = pricing;
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      milkSize: input.milkSize,
      customQuantityLiters: input.customQuantityLiters,
      quantity: input.quantity,
      deliveryDate: input.deliveryDate ? businessDateOnlyToDate(input.deliveryDate) : undefined,
      deliveryWindow: input.deliveryWindow,
      customWindowStart: input.customWindowStart,
      customWindowEnd: input.customWindowEnd,
      deliveryNotes: input.deliveryNotes,
      paymentStatus: input.paymentStatus,
      addressId: input.addressId,
      ...pricingPatch,
    },
  });

  await recordAudit({
    action: "ORDER_EDITED",
    entityType: "Order",
    entityId: orderId,
    actorUserId: input.actorUserId,
    metadata: { changedFields },
  });

  return updated;
}

export interface ListOrdersFilter {
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  status?: OrderStatus[];
  subscriptionOnly?: boolean;
  search?: string;
}

export async function listOrders(filter: ListOrdersFilter = {}) {
  return db.order.findMany({
    where: {
      deliveryDate:
        filter.deliveryDateFrom || filter.deliveryDateTo
          ? {
              gte: filter.deliveryDateFrom ? businessDateOnlyToDate(filter.deliveryDateFrom) : undefined,
              lte: filter.deliveryDateTo ? businessDateOnlyToDate(filter.deliveryDateTo) : undefined,
            }
          : undefined,
      status: filter.status ? { in: filter.status } : undefined,
      subscriptionId: filter.subscriptionOnly ? { not: null } : undefined,
      customer: filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { phone: { contains: filter.search } },
            ],
          }
        : undefined,
    },
    include: { customer: true, address: true },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function getOrderDetail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      address: true,
      payments: true,
      routeStops: { include: { route: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) throw new NotFoundError("Order not found");

  // The stop on whichever route is currently active, if any — older
  // stops from superseded (CANCELLED) revisions are history, not "the"
  // current route for this order.
  const activeRouteStop = order.routeStops.find((s) => s.route.status === "PLANNED" || s.route.status === "IN_PROGRESS");

  return { ...order, activeRouteStop };
}

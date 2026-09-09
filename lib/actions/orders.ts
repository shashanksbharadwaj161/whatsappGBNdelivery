"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import * as ordersService from "@/lib/services/orders";
import * as customersService from "@/lib/services/customers";
import { createAddress, type CreateAddressInput } from "@/lib/services/addresses";
import type { DeliveryWindow, MilkSize, OrderSource, OrderType, PaymentStatus } from "@prisma/client";

export interface CreateOrderActionInput {
  customer: { name: string; phone: string; email?: string };
  address: Omit<CreateAddressInput, "customerId">;
  milkSize: MilkSize;
  customQuantityLiters?: number | null;
  quantity: number;
  orderType: OrderType;
  source?: OrderSource;
  conversationId?: string | null;
  deliveryDate: string;
  deliveryWindow: DeliveryWindow;
  customWindowStart?: string | null;
  customWindowEnd?: string | null;
  deliveryNotes?: string | null;
  googleMapsUrl?: string | null;
  paymentStatus?: PaymentStatus;
}

export async function createOrderAction(input: CreateOrderActionInput) {
  const user = await requireRole(["OWNER"]);

  const customer = await customersService.findOrCreateCustomerByPhone({
    name: input.customer.name,
    phone: input.customer.phone,
    email: input.customer.email,
    actorUserId: user.userId,
  });

  const address = await createAddress({ ...input.address, customerId: customer.id });

  if (!customer.defaultAddressId) {
    await db.customer.update({ where: { id: customer.id }, data: { defaultAddressId: address.id } });
  }

  const order = await ordersService.createOrder({
    customerId: customer.id,
    addressId: address.id,
    conversationId: input.conversationId ?? null,
    milkSize: input.milkSize,
    customQuantityLiters: input.customQuantityLiters,
    quantity: input.quantity,
    orderType: input.orderType,
    source: input.source ?? "MANUAL",
    deliveryDate: input.deliveryDate,
    deliveryWindow: input.deliveryWindow,
    customWindowStart: input.customWindowStart,
    customWindowEnd: input.customWindowEnd,
    deliveryNotes: input.deliveryNotes,
    googleMapsUrl: input.googleMapsUrl,
    paymentStatus: input.paymentStatus,
    createdByUserId: user.userId,
  });

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return order;
}

export async function confirmOrderAction(orderId: string) {
  const user = await requireRole(["OWNER"]);
  const order = await ordersService.confirmOrder(orderId, user.userId);
  revalidatePath("/orders");
  return order;
}

export async function cancelOrderAction(orderId: string, reason?: string) {
  const user = await requireRole(["OWNER"]);
  const order = await ordersService.cancelOrder(orderId, reason, user.userId);
  revalidatePath("/orders");
  return order;
}

export async function updateOrderAction(orderId: string, input: ordersService.UpdateOrderInput) {
  const user = await requireRole(["OWNER"]);
  const order = await ordersService.updateOrder(orderId, { ...input, actorUserId: user.userId });
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return order;
}

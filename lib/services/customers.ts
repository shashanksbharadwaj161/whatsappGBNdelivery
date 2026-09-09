import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { normalizePhoneToE164 } from "@/lib/phone";

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  alternatePhone?: string;
  notes?: string;
  actorUserId?: string;
}

/** Always find-or-create by normalized phone — never a silent duplicate. */
export async function findOrCreateCustomerByPhone(input: CreateCustomerInput) {
  const phone = normalizePhoneToE164(input.phone);
  if (input.email && !z.email().safeParse(input.email).success) throw new ValidationError("Enter a valid email address");

  const existing = await db.customer.findUnique({ where: { phone } });
  if (existing) {
    if (input.email) return db.customer.update({ where: { id: existing.id }, data: { email: input.email } });
    return existing;
  }

  const customer = await db.customer.create({
    data: {
      name: input.name,
      phone,
      email: input.email,
      alternatePhone: input.alternatePhone,
      notes: input.notes,
    },
  });

  await recordAudit({
    action: "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: customer.id,
    actorUserId: input.actorUserId,
  });

  return customer;
}

export async function listCustomers(params: { search?: string } = {}) {
  return db.customer.findMany({
    where: params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { phone: { contains: params.search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { defaultAddress: true },
  });
}

export async function getCustomerDetail(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      defaultAddress: true,
      addressesOwned: { orderBy: { createdAt: "desc" } },
      subscriptions: { orderBy: { createdAt: "desc" }, include: { address: true } },
      orders: {
        orderBy: { deliveryDate: "desc" },
        take: 50,
        include: { address: true },
      },
    },
  });

  if (!customer) throw new NotFoundError("Customer not found");

  const deliveredOrders = customer.orders.filter((o) => o.status === "DELIVERED");
  const totalLitres = deliveredOrders.reduce((sum, o) => {
    if (o.milkSize === "ML500") return sum + 0.5 * o.quantity;
    if (o.milkSize === "L1") return sum + 1 * o.quantity;
    return sum + (o.customQuantityLiters ?? 0) * o.quantity;
  }, 0);
  const totalSpent = deliveredOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const lastDelivery = deliveredOrders
    .map((o) => o.deliveryDate)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    customer,
    stats: {
      totalLitres,
      totalSpent,
      lastDelivery: lastDelivery ?? null,
      activeSubscription: customer.subscriptions.find((s) => s.status === "ACTIVE") ?? null,
    },
  };
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  alternatePhone?: string;
  notes?: string;
  isActive?: boolean;
  actorUserId?: string;
}

export async function updateCustomer(customerId: string, input: UpdateCustomerInput) {
  const existing = await db.customer.findUnique({ where: { id: customerId } });
  if (!existing) throw new NotFoundError("Customer not found");

  if (input.email && !z.email().safeParse(input.email).success) throw new ValidationError("Enter a valid email address");
  const normalizedPhone = input.phone ? normalizePhoneToE164(input.phone) : undefined;
  if (normalizedPhone && normalizedPhone !== existing.phone) {
    const phoneTaken = await db.customer.findUnique({ where: { phone: normalizedPhone } });
    if (phoneTaken) {
      throw new ConflictError("This phone number is already in use by another customer");
    }
  }

  const changedFields = Object.keys(input).filter(
    (k) => k !== "actorUserId" && (input as Record<string, unknown>)[k] !== undefined
  );

  const updated = await db.customer.update({
    where: { id: customerId },
    data: {
      name: input.name,
      phone: normalizedPhone,
      email: input.email,
      alternatePhone: input.alternatePhone,
      notes: input.notes,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    action: "CUSTOMER_EDITED",
    entityType: "Customer",
    entityId: customerId,
    actorUserId: input.actorUserId,
    metadata: { changedFields },
  });

  return updated;
}

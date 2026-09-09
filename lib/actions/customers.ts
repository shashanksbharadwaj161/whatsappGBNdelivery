"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import * as customersService from "@/lib/services/customers";

export async function createCustomerAction(input: {
  name: string;
  phone: string;
  email?: string;
  alternatePhone?: string;
  notes?: string;
}) {
  const user = await requireRole(["OWNER"]);
  const customer = await customersService.findOrCreateCustomerByPhone({
    ...input,
    actorUserId: user.userId,
  });
  revalidatePath("/customers");
  return customer;
}

export async function updateCustomerAction(
  customerId: string,
  input: customersService.UpdateCustomerInput
) {
  const user = await requireRole(["OWNER"]);
  const customer = await customersService.updateCustomer(customerId, {
    ...input,
    actorUserId: user.userId,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return customer;
}

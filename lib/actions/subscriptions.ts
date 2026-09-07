"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import * as subscriptionsService from "@/lib/services/subscriptions";
import { generateDailyOrders } from "@/lib/services/subscriptionGeneration";
import { todayBusinessDateString } from "@/lib/tz";
import type { CreateSubscriptionInput } from "@/lib/services/subscriptions";

export async function createSubscriptionAction(input: Omit<CreateSubscriptionInput, "actorUserId">) {
  const user = await requireRole(["OWNER"]);
  const subscription = await subscriptionsService.createSubscription({ ...input, actorUserId: user.userId });
  revalidatePath(`/customers/${input.customerId}`);
  return subscription;
}

export async function pauseSubscriptionAction(subscriptionId: string, customerId: string) {
  const user = await requireRole(["OWNER"]);
  const result = await subscriptionsService.pauseSubscription(subscriptionId, user.userId);
  revalidatePath(`/customers/${customerId}`);
  return result;
}

export async function resumeSubscriptionAction(subscriptionId: string, customerId: string) {
  const user = await requireRole(["OWNER"]);
  const result = await subscriptionsService.resumeSubscription(subscriptionId, user.userId);
  revalidatePath(`/customers/${customerId}`);
  return result;
}

export async function cancelSubscriptionAction(subscriptionId: string, customerId: string) {
  const user = await requireRole(["OWNER"]);
  const result = await subscriptionsService.cancelSubscription(subscriptionId, user.userId);
  revalidatePath(`/customers/${customerId}`);
  return result;
}

export async function skipTomorrowAction(subscriptionId: string, customerId: string) {
  const user = await requireRole(["OWNER"]);
  const result = await subscriptionsService.skipTomorrow(subscriptionId, user.userId);
  revalidatePath(`/customers/${customerId}`);
  return result;
}

export async function runDailyGenerationNowAction() {
  await requireRole(["OWNER"]);
  const result = await generateDailyOrders(todayBusinessDateString());
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return result;
}

"use server";

import { requireRole } from "@/lib/auth/guard";
import { computeDeliveryEconomics } from "@/lib/services/deliveryEconomics";

export async function getDeliveryEconomicsAction(latitude: number, longitude: number, deliveryDate: string) {
  await requireRole(["OWNER"]);
  return computeDeliveryEconomics(latitude, longitude, deliveryDate);
}

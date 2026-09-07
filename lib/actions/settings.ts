"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { setDefaultStartLocation, type DefaultStartLocation } from "@/lib/services/settings";

export async function updateDefaultStartLocationAction(value: DefaultStartLocation) {
  await requireRole(["OWNER"]);
  const result = await setDefaultStartLocation(value);
  revalidatePath("/settings");
  revalidatePath("/routes");
  return result;
}

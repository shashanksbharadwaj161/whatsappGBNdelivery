"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import * as conversationsService from "@/lib/services/conversations";
import type { ConversationStatus } from "@prisma/client";

export async function markConversationReadAction(conversationId: string) {
  await requireRole(["OWNER"]);
  await conversationsService.markConversationRead(conversationId);
  revalidatePath("/inbox");
}

export async function setConversationStatusAction(conversationId: string, status: ConversationStatus) {
  await requireRole(["OWNER"]);
  const conversation = await conversationsService.setConversationStatus(conversationId, status);
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${conversationId}`);
  return conversation;
}

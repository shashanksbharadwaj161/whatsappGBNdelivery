"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setConversationStatusAction } from "@/lib/actions/conversations";

export function ConversationActions({
  conversationId,
  customerId,
  customerName,
  customerPhone,
  status,
}: {
  conversationId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  status: "OPEN" | "LEAD" | "ARCHIVED";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/orders/new?name=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(customerPhone)}&conversationId=${conversationId}`}
      >
        <Button size="sm">Create order</Button>
      </Link>
      {customerId && (
        <Link href={`/customers/${customerId}`}>
          <Button size="sm" variant="outline">
            View customer
          </Button>
        </Link>
      )}
      {status !== "LEAD" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setConversationStatusAction(conversationId, "LEAD");
              router.refresh();
            })
          }
        >
          Mark as lead
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setConversationStatusAction(conversationId, "ARCHIVED");
              router.refresh();
            })
          }
        >
          Archive
        </Button>
      )}
    </div>
  );
}

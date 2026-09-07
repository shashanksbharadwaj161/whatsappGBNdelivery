"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { confirmOrderAction, cancelOrderAction } from "@/lib/actions/orders";

export function OrderActions({
  orderId,
  status,
  hasCoordinates,
}: {
  orderId: string;
  status: string;
  hasCoordinates: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "PENDING" && status !== "CONFIRMED") return null;

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-status-cancelled">{error}</p>}
      <div className="flex gap-2">
        {status === "PENDING" && (
          <Button
            disabled={pending || !hasCoordinates}
            title={!hasCoordinates ? "Address needs a resolved location before this order can be confirmed" : undefined}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await confirmOrderAction(orderId);
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not confirm order");
                }
              })
            }
          >
            Confirm order
          </Button>
        )}
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await cancelOrderAction(orderId);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not cancel order");
              }
            })
          }
        >
          Cancel order
        </Button>
      </div>
    </div>
  );
}

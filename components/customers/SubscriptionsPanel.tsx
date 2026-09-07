"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label, Select } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { MILK_SIZE_LABEL } from "@/lib/statusStyles";
import { todayBusinessDateString } from "@/lib/tz";
import {
  createSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  cancelSubscriptionAction,
  skipTomorrowAction,
} from "@/lib/actions/subscriptions";
import type { MilkSize, SubscriptionFrequency, SubscriptionStatus } from "@prisma/client";

const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, "delivered" | "pending" | "cancelled" | "neutral"> = {
  ACTIVE: "delivered",
  PAUSED: "pending",
  CANCELLED: "cancelled",
  COMPLETED: "neutral",
};

export interface SubscriptionView {
  id: string;
  milkSize: MilkSize;
  quantity: number;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  address: string;
  startDate: string;
}

export function SubscriptionsPanel({
  customerId,
  defaultAddressId,
  subscriptions,
}: {
  customerId: string;
  defaultAddressId: string | null;
  subscriptions: SubscriptionView[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [milkSize, setMilkSize] = useState<MilkSize>("L1");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium text-ink">Subscriptions</p>
          {defaultAddressId && (
            <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} /> New
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-status-cancelled">{error}</p>}

        {showForm && defaultAddressId && (
          <form
            className="space-y-3 rounded-lg border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              act(() =>
                createSubscriptionAction({
                  customerId,
                  addressId: defaultAddressId,
                  milkSize,
                  quantity: 1,
                  frequency: "DAILY",
                  startDate: todayBusinessDateString(),
                  deliveryWindow: "MORNING",
                })
              );
              setShowForm(false);
            }}
          >
            <div>
              <Label htmlFor="subMilkSize">Milk quantity</Label>
              <Select id="subMilkSize" value={milkSize} onChange={(e) => setMilkSize(e.target.value as MilkSize)}>
                <option value="ML500">500 ml</option>
                <option value="L1">1 Litre</option>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Start daily subscription
            </Button>
          </form>
        )}

        {subscriptions.length === 0 && <p className="text-sm text-ink-muted">No subscriptions yet.</p>}

        {subscriptions.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">
                {s.quantity}× {MILK_SIZE_LABEL[s.milkSize]} · {s.frequency === "DAILY" ? "Daily" : s.frequency.replace(/_/g, " ")}
              </p>
              <Badge tone={SUBSCRIPTION_STATUS_TONE[s.status]}>{s.status}</Badge>
            </div>
            <p className="text-xs text-ink-muted">{s.address}</p>
            <p className="text-xs text-ink-faint">Since {s.startDate}</p>

            {s.status !== "CANCELLED" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.status === "ACTIVE" && (
                  <>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => pauseSubscriptionAction(s.id, customerId))}>
                      Pause
                    </Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => skipTomorrowAction(s.id, customerId))}>
                      Skip tomorrow
                    </Button>
                  </>
                )}
                {s.status === "PAUSED" && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => resumeSubscriptionAction(s.id, customerId))}>
                    Resume
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => cancelSubscriptionAction(s.id, customerId))}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

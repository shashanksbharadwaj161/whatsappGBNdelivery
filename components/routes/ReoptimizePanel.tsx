"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { RoutableOrder } from "@/components/routes/RouteOptimizerPanel";

export function ReoptimizePanel({ routeId, availableOrders }: { routeId: string; availableOrders: RoutableOrder[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleReoptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/reoptimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalOrderIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Could not re-optimize the route");
        return;
      }
      router.push(`/routes/${data.id}`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an order &amp; re-optimize</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-ink-muted">
          Already-completed stops stay exactly as they are — only the remaining stops (plus anything you
          add here) get re-ordered.
        </p>
        {availableOrders.length > 0 ? (
          <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {availableOrders.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-alt">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="flex-1">{o.customerName}</span>
                <span className="text-ink-muted">{o.area ?? ""}</span>
                <span className="text-ink-muted">{o.quantity}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No other confirmed, unrouted orders for today to add.</p>
        )}
        {error && <p className="text-sm text-status-cancelled">{error}</p>}
        <Button variant="outline" disabled={loading} onClick={handleReoptimize}>
          <RefreshCw size={14} /> {loading ? "Re-optimizing…" : "Re-optimize remaining route"}
        </Button>
      </CardContent>
    </Card>
  );
}

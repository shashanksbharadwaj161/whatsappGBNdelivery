"use client";

import { getCurrentLocation } from "@/lib/maps/current-location";
import { LocationPinDropMap } from "@/components/maps/LocationPinDropMap";
import { businessDateAndTimeToUtc, todayBusinessDateString, formatBusinessTime } from "@/lib/tz";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";

export interface RoutableOrder {
  id: string;
  customerName: string;
  area: string | null;
  quantity: string;
}

export function RouteOptimizerPanel({
  orders,
  preselectedIds,
  defaultStart,
}: {
  orders: RoutableOrder[];
  preselectedIds: string[];
  defaultStart: { lat: number; lng: number; label: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(preselectedIds.length ? preselectedIds : orders.map((o) => o.id))
  );
  const [startLat, setStartLat] = useState(String(defaultStart.lat));
  const [startLng, setStartLng] = useState(String(defaultStart.lng));
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    return formatBusinessTime(now, "HH:mm");
  });
  const [locating, setLocating] = useState(false);
  const [returnToStart, setReturnToStart] = useState(false);
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

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const startDateTime = businessDateAndTimeToUtc(todayBusinessDateString(), startTime);

      const res = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: Array.from(selected),
          returnToStart,
          startLat: Number(startLat),
          startLng: Number(startLng),
          startTime: startDateTime.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Could not optimize route");
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
      <CardContent className="space-y-4">
        <div><h2 className="font-display text-xl">Plan your delivery round</h2><p className="mt-1 text-sm text-ink-muted">Start from your current location or move the pin. We’ll order the selected stops using road distances.</p></div>
        <Button variant="outline" disabled={locating} onClick={async()=>{setLocating(true);setError(null);try{const p=await getCurrentLocation();setStartLat(String(p.lat));setStartLng(String(p.lng));}catch(e){setError(e instanceof Error?e.message:"Location unavailable");}finally{setLocating(false);}}}>{locating?"Finding your location…":"Use my current location"}</Button>
        <LocationPinDropMap latitude={Number(startLat)} longitude={Number(startLng)} defaultCenter={defaultStart} onPinChange={p=>{setStartLat(String(p.lat));setStartLng(String(p.lng));}} />
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={returnToStart} onChange={e=>setReturnToStart(e.target.checked)}/>Return to the starting point after the last delivery</label>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="startLat">Starting point (lat)</Label>
            <Input id="startLat" type="number" step="any" value={startLat} onChange={(e) => setStartLat(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="startLng">Starting point (lng)</Label>
            <Input id="startLng" type="number" step="any" value={startLng} onChange={(e) => setStartLng(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="startTime">Starting time (IST)</Label>
            <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-ink-faint">Default start: {defaultStart.label}. Change it any time in Settings.</p>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Orders to deliver ({selected.size} selected)</p>
          <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {orders.map((o) => (
              <label key={o.id} className="flex min-h-14 cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm hover:bg-surface-alt">
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
            {orders.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-muted">No confirmed, unrouted orders for today.</p>}
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-status-cancelled">{error}</p>}
        <Button disabled={loading || selected.size === 0} onClick={handleOptimize}>
          <RouteIcon size={16} /> {loading ? "Optimizing…" : "Optimize route"}
        </Button>
      </CardContent>
    </Card>
  );
}

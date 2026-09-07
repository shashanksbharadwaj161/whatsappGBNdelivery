"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Navigation, Phone, MessageCircle, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ROUTE_STOP_STATUS_STYLE } from "@/lib/statusStyles";

export interface DriverStopView {
  id: string;
  stopNumber: number;
  customerName: string;
  customerPhone: string;
  area: string | null;
  address: string;
  quantity: string;
  status: keyof typeof ROUTE_STOP_STATUS_STYLE;
  estimatedArrival: string | null;
  latitude: number;
  longitude: number;
}

export function DriverRouteView({
  routeId,
  routeStatus,
  stops,
}: {
  routeId: string;
  routeStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  stops: DriverStopView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const completedCount = stops.filter((s) => s.status !== "PENDING" && s.status !== "EN_ROUTE").length;
  const nextStop = stops.find((s) => s.status === "PENDING" || s.status === "EN_ROUTE");

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/routes/${routeId}/start`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message ?? "Could not start route");
        return;
      }
      router.refresh();
    });
  }

  function handleStopAction(stopId: string, status: "DELIVERED" | "SKIPPED" | "UNAVAILABLE") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/driver/stops/${stopId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message ?? "Could not update this stop");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">
          {completedCount} / {stops.length} deliveries completed
        </p>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${stops.length ? (completedCount / stops.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-status-cancelled">{error}</p>}

      {routeStatus === "PLANNED" && (
        <Button className="w-full" size="lg" disabled={pending} onClick={handleStart}>
          Start today&rsquo;s route
        </Button>
      )}

      {routeStatus !== "PLANNED" && nextStop && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Next stop</p>
          <p className="font-display text-lg text-ink">{nextStop.customerName}</p>
          <p className="text-sm text-ink">{nextStop.quantity}</p>
          <p className="text-sm text-ink-muted">{nextStop.area ?? nextStop.address}</p>
          {nextStop.estimatedArrival && <p className="mt-1 text-sm font-medium text-primary">ETA {nextStop.estimatedArrival}</p>}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${nextStop.latitude},${nextStop.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm" className="w-full">
                <Navigation size={14} /> Navigate
              </Button>
            </a>
            <a href={`tel:${nextStop.customerPhone}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Phone size={14} /> Call
              </Button>
            </a>
            <a href={`https://wa.me/${nextStop.customerPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full">
                <MessageCircle size={14} /> WhatsApp
              </Button>
            </a>
          </div>

          <Button
            className="mt-3 w-full"
            disabled={pending}
            onClick={() => handleStopAction(nextStop.id, "DELIVERED")}
          >
            <CheckCircle2 size={16} /> Delivered
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => handleStopAction(nextStop.id, "UNAVAILABLE")}
            >
              <XCircle size={14} /> Customer unavailable
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => handleStopAction(nextStop.id, "SKIPPED")}>
              <SkipForward size={14} /> Skip
            </Button>
          </div>
        </div>
      )}

      {routeStatus !== "PLANNED" && !nextStop && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-6 text-center">
          <CheckCircle2 size={28} className="mx-auto mb-2 text-primary" />
          <p className="font-medium text-ink">All deliveries complete for today.</p>
        </div>
      )}

      <div className="space-y-2">
        {stops.map((stop) => {
          const style = ROUTE_STOP_STATUS_STYLE[stop.status];
          return (
            <div
              key={stop.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <div>
                <span className="mr-2 text-ink-faint">{stop.stopNumber}.</span>
                <span className="text-ink">{stop.customerName}</span>
              </div>
              <Badge tone={style.tone}>{style.label}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

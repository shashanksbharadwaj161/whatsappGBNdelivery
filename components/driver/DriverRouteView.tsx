"use client";

import { PlanFromLocation } from "./PlanFromLocation";
import { useRoadGeometry } from "@/lib/maps/useRoadGeometry";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Navigation,
  Phone,
  MessageCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LeafletMap, type LeafletMarker } from "@/components/maps/LeafletMap";
import { PIN_COLORS } from "@/components/routes/RouteMap";
import { ROUTE_STOP_STATUS_STYLE } from "@/lib/statusStyles";

export interface DriverStopView {
  id: string;
  stopNumber: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  product?: string;
  area: string | null;
  address: string;
  quantity: string;
  status: keyof typeof ROUTE_STOP_STATUS_STYLE;
  estimatedArrival: string | null;
  latitude: number;
  longitude: number;
}

const UNAVAILABLE_REASONS = ["Not home", "Not answering", "Wrong address", "Asked to come later"];

type Mode = "idle" | "confirmDeliver" | "pickReason";

// Solid fills for anything already actioned, outline for what's still ahead —
// legible as a status stepper at a glance, not just next to a text label.
const STEPPER_TONE: Record<DriverStopView["status"], string> = {
  PENDING: "bg-surface-alt text-ink-muted border border-border",
  EN_ROUTE: "bg-surface-alt text-ink-muted border border-border",
  DELIVERED: "bg-primary text-white",
  SKIPPED: "bg-[var(--color-status-skipped)] text-white",
  UNAVAILABLE: "bg-status-cancelled text-white",
};

export function DriverRouteView({
  routeId,
  routeStatus,
  awaitingDriverLocation = false,
  stops,
}: {
  routeId: string;
  awaitingDriverLocation?: boolean;
  routeStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  stops: DriverStopView[];
}) {
  const router = useRouter();
  const road = useRoadGeometry(awaitingDriverLocation ? undefined : routeId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [justDelivered, setJustDelivered] = useState(false);
  const [showAllStops, setShowAllStops] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string>();
  const selectedStop = stops.find(stop => stop.id === selectedStopId);

  const completedCount = stops.filter((s) => s.status !== "PENDING" && s.status !== "EN_ROUTE").length;
  const nextStop = stops.find((s) => s.status === "PENDING" || s.status === "EN_ROUTE");
  const progressPct = stops.length ? (completedCount / stops.length) * 100 : 0;

  const mapMarkers: LeafletMarker[] = stops.map((s) => ({
    id: s.id,
    lat: s.latitude,
    lng: s.longitude,
    label: String(s.stopNumber),
    color: PIN_COLORS[s.status],
    title: `${s.stopNumber}. ${s.customerName}`,
    emphasized: nextStop?.id === s.id,
    details: { name: s.customerName, phone: s.customerPhone, email: s.customerEmail, product: s.product ?? "A2 milk", quantity: s.quantity, address: s.address },
  }));
  const mapCenter = nextStop
    ? { lat: nextStop.latitude, lng: nextStop.longitude }
    : stops[0]
      ? { lat: stops[0].latitude, lng: stops[0].longitude }
      : { lat: 13.067, lng: 77.556 };

  function handleStart() {
    setError(null);
    startTransition(async () => {
      try {
      const res = await fetch(`/api/routes/${routeId}/start`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message ?? "Could not start route");
        return;
      }
      router.refresh();
      } catch { setError("Connection lost. Refresh to check whether the route started, then try again."); }
    });
  }

  function submitStopAction(stopId: string, status: "DELIVERED" | "SKIPPED" | "UNAVAILABLE", failureReason?: string) {
    setError(null);
    startTransition(async () => {
      try {
      const res = await fetch(`/api/driver/stops/${stopId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, failureReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message ?? "Could not update this stop");
        setMode("idle");
        return;
      }
      if (status === "DELIVERED") {
        setJustDelivered(true);
        setTimeout(() => {
          setJustDelivered(false);
          setMode("idle");
          router.refresh();
        }, 850);
      } else {
        setMode("idle");
        router.refresh();
      }
      } catch { setError("Could not confirm the update. Check your connection and refresh before trying again."); setMode("idle"); }
    });
  }

  return (
    <div className="relative">
      {/* Sticky progress header — stays visible while scrolling the stop list. */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium text-ink">
            {completedCount} / {stops.length} deliveries
          </p>
          {nextStop && <Badge tone="pending">Stop {nextStop.stopNumber} next</Badge>}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="space-y-4 pb-36">
        {(routeStatus === "PLANNED" || routeStatus === "IN_PROGRESS") && <PlanFromLocation routeId={routeId} />}
        {awaitingDriverLocation && <p className="rounded-lg bg-surface-alt p-4 text-sm">Your WhatsApp delivery stops are ready. Allow location access above to calculate the visiting order before starting.</p>}
        {error && <p role="alert" className="rounded-lg bg-status-cancelled-soft px-3 py-2 text-sm text-status-cancelled">{error}</p>}

        {routeStatus === "PLANNED" && !awaitingDriverLocation && (
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="mb-3 text-sm text-ink-muted">
              {stops.length} stop{stops.length === 1 ? "" : "s"} ready for this round.
            </p>
            <Button size="xl" className="w-full" disabled={pending} onClick={handleStart}>
              Start delivery round
            </Button>
          </div>
        )}

        {routeStatus === "IN_PROGRESS" && nextStop && (
          <div className="rounded-2xl border border-primary/30 bg-primary-soft p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next stop</p>
              {nextStop.estimatedArrival && <p className="text-xs font-semibold text-primary">ETA {nextStop.estimatedArrival}</p>}
            </div>
            <p className="font-display text-2xl leading-tight text-ink">{nextStop.customerName}</p>
            <p className="mt-0.5 text-base text-ink">{nextStop.quantity}</p>
            <p className="text-sm text-ink-muted">{nextStop.address}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${nextStop.latitude},${nextStop.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface py-3 text-ink transition-transform active:scale-[0.97]"
              >
                <Navigation size={22} />
                <span className="text-xs font-medium">Navigate</span>
              </a>
              <a
                href={`tel:${nextStop.customerPhone}`}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface py-3 text-ink transition-transform active:scale-[0.97]"
              >
                <Phone size={22} />
                <span className="text-xs font-medium">Call</span>
              </a>
              <a
                href={`https://wa.me/${nextStop.customerPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface py-3 text-ink transition-transform active:scale-[0.97]"
              >
                <MessageCircle size={22} />
                <span className="text-xs font-medium">WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        {routeStatus === "COMPLETED" && !nextStop && stops.length > 0 && (
          <div className="rounded-2xl border border-primary/30 bg-primary-soft p-8 text-center">
            <PartyPopper size={32} className="mx-auto mb-2 text-primary" />
            <p className="font-display text-lg text-ink">All caught up!</p>
            <p className="mt-1 text-sm text-ink-muted">Every stop on today&rsquo;s route has been handled.</p>
          </div>
        )}

        {stops.length > 0 && (
          <div>
            <LeafletMap center={mapCenter} markers={mapMarkers} fitToMarkers heightClassName="h-80" polyline={road} roadPath selectedMarkerId={selectedStopId} onMarkerSelect={setSelectedStopId} />
            <p className="mt-2 text-xs text-ink-muted">{road ? "OpenStreetMap road preview. Use Navigate for driving directions." : "Road preview unavailable. Tap a delivery pin or use Navigate."}</p>
            {selectedStop && <div className="mt-3 rounded-xl bg-surface-alt p-4">
              <p className="font-semibold">Stop {selectedStop.stopNumber} · {selectedStop.customerName}</p>
              <p className="mt-1 text-sm text-ink-muted">{selectedStop.address}</p>
              <p className="mt-1 text-sm">{selectedStop.quantity} · {ROUTE_STOP_STATUS_STYLE[selectedStop.status].label}</p>
              <a className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.latitude},${selectedStop.longitude}&travelmode=driving`}><Navigation size={18} /> Navigate to this stop</a>
            </div>}
          </div>
        )}

        {stops.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {stops.map((s) => (
              <button
                type="button"
                onClick={() => setSelectedStopId(s.id)}
                aria-label={`Show stop ${s.stopNumber}: ${s.customerName}`}
                aria-pressed={selectedStopId === s.id}
                key={s.id}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  STEPPER_TONE[s.status],
                  nextStop?.id === s.id && "ring-2 ring-primary ring-offset-2 ring-offset-bg"
                )}
              >
                {s.stopNumber}
              </button>
            ))}
          </div>
        )}

        {stops.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={showAllStops}
              onClick={() => setShowAllStops((v) => !v)}
              className="flex w-full items-center justify-center gap-1 min-h-11 py-1 text-sm font-medium text-ink-muted"
            >
              {showAllStops ? "Hide full stop list" : `View all ${stops.length} stops`}
              {showAllStops ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showAllStops && (
              <div className="mt-2 space-y-2">
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
                        <p className="ml-5 text-xs text-ink-muted">{stop.quantity}</p>
                      </div>
                      <Badge tone={style.tone}>{style.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom action bar — thumb zone, always reachable one-handed. */}
      {routeStatus === "IN_PROGRESS" && nextStop && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-surface px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          {mode === "idle" && (
            <>
              <Button size="xl" className="w-full" disabled={pending} onClick={() => setMode("confirmDeliver")}>
                <CheckCircle2 size={22} /> Mark delivered
              </Button>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => setMode("pickReason")}
                >
                  Customer unavailable
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => submitStopAction(nextStop.id, "SKIPPED")}
                >
                  Skip
                </Button>
              </div>
            </>
          )}

          {mode === "confirmDeliver" && (
            <>
              <p className="mb-2 text-center text-sm text-ink-muted">
                Confirm delivery to <span className="font-medium text-ink">{nextStop.customerName}</span>?
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={pending} onClick={() => setMode("idle")}>
                  Cancel
                </Button>
                <Button
                  size="xl"
                  className="flex-[2]"
                  disabled={pending}
                  onClick={() => submitStopAction(nextStop.id, "DELIVERED")}
                >
                  <CheckCircle2 size={20} /> Yes, delivered
                </Button>
              </div>
            </>
          )}

          {mode === "pickReason" && (
            <>
              <p className="mb-2 text-sm text-ink-muted">Why is {nextStop.customerName} unavailable?</p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {UNAVAILABLE_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    disabled={pending}
                    onClick={() => submitStopAction(nextStop.id, "UNAVAILABLE", reason)}
                    className="rounded-xl border border-border bg-surface-alt px-3 py-3 text-sm text-ink transition-transform active:scale-[0.97] disabled:opacity-50"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <Button variant="outline" className="w-full" disabled={pending} onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {/* Success flash */}
      {justDelivered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/95">
          <div className="flex animate-success-pop flex-col items-center gap-3 text-white">
            <CheckCircle2 size={64} />
            <p className="text-xl font-medium">Delivered!</p>
          </div>
        </div>
      )}
    </div>
  );
}

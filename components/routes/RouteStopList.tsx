import { MapPin, Milestone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ROUTE_STOP_STATUS_STYLE } from "@/lib/statusStyles";

export interface RouteStopView {
  id: string;
  stopNumber: number;
  customerName: string;
  address: string;
  quantity: string;
  status: keyof typeof ROUTE_STOP_STATUS_STYLE;
  distanceFromPreviousKm: number | null;
  estimatedArrival: string | null; // formatted, e.g. "6:15 AM"
}

export function RouteStopList({ startLabel, stops }: { startLabel: string; stops: RouteStopView[] }) {
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
          <MapPin size={14} />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Start</p>
          <p className="text-sm font-medium text-ink">{startLabel}</p>
        </div>
      </div>

      {stops.map((stop) => {
        const style = ROUTE_STOP_STATUS_STYLE[stop.status];
        return (
          <div key={stop.id}>
            <div className="ml-4 flex items-center gap-2 py-1 pl-[9px] text-xs text-ink-faint">
              <Milestone size={12} />
              {stop.distanceFromPreviousKm !== null && <span>{stop.distanceFromPreviousKm.toFixed(1)} km</span>}
            </div>
            <div className="flex items-start gap-3 border-l-2 border-dashed border-border pl-0">
              <span className="-ml-[17px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-alt text-sm font-semibold text-ink">
                {stop.stopNumber}
              </span>
              <div className="flex-1 rounded-lg border border-border bg-surface px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{stop.customerName}</p>
                  <Badge tone={style.tone}>{style.label}</Badge>
                </div>
                <p className="text-xs text-ink-muted">{stop.quantity}</p>
                <p className="text-xs text-ink-muted">{stop.address}</p>
                {stop.estimatedArrival && <p className="mt-1 text-xs font-medium text-primary">ETA {stop.estimatedArrival}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

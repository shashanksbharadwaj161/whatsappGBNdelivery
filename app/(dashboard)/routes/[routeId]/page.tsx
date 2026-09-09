import { PlanFromLocation } from "@/components/driver/PlanFromLocation";
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RouteStopList, type RouteStopView } from "@/components/routes/RouteStopList";
import { RouteMap, type RouteMapStop } from "@/components/routes/RouteMap";
import { ReoptimizePanel } from "@/components/routes/ReoptimizePanel";
import type { RoutableOrder } from "@/components/routes/RouteOptimizerPanel";
import { getRouteDetail, listRoutableOrdersForDate } from "@/lib/services/routes";
import { formatBusinessTime, dateToBusinessDateString } from "@/lib/tz";
import { MILK_SIZE_LABEL } from "@/lib/statusStyles";
import { getOrNotFound } from "@/lib/notFoundGuard";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const route = await getOrNotFound(() => getRouteDetail(routeId));

  const stopViews: RouteStopView[] = route.stops.map((stop) => ({
    id: stop.id,
    stopNumber: stop.stopNumber,
    customerName: stop.customerNameSnapshot,
    details: { name: stop.customerNameSnapshot, phone: stop.order.customer.phone, email: stop.order.customer.email, product: "A2 milk", quantity: stop.quantitySnapshot, address: stop.addressTextSnapshot },
    address: stop.addressTextSnapshot,
    quantity: stop.quantitySnapshot,
    status: stop.status,
    distanceFromPreviousKm: stop.plannedDistanceFromPreviousKm,
    estimatedArrival: stop.estimatedArrival ? formatBusinessTime(stop.estimatedArrival) : null,
  }));

  const mapStops: RouteMapStop[] = route.stops.map((stop) => ({
    id: stop.id,
    stopNumber: stop.stopNumber,
    lat: stop.latitudeSnapshot,
    lng: stop.longitudeSnapshot,
    status: stop.status,
    customerName: stop.customerNameSnapshot,
    details: { name: stop.customerNameSnapshot, phone: stop.order.customer.phone, email: stop.order.customer.email, product: "A2 milk", quantity: stop.quantitySnapshot, address: stop.addressTextSnapshot },
  }));

  const lastStop = route.stops[route.stops.length - 1];
  const canReoptimize = route.status === "PLANNED" || route.status === "IN_PROGRESS";
  const routedOrderIds = new Set(route.stops.map((s) => s.orderId));
  const availableOrders: RoutableOrder[] = canReoptimize
    ? (await listRoutableOrdersForDate(dateToBusinessDateString(route.date)))
        .filter((o) => !routedOrderIds.has(o.id))
        .map((o) => ({
          id: o.id,
          customerName: o.customer.name,
          area: o.address.area,
          quantity: `${o.quantity}× ${MILK_SIZE_LABEL[o.milkSize] ?? o.milkSize}`,
        }))
    : [];

  return (
    <div>
      <Link href="/routes" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to routes
      </Link>
      <PageHeader
        title={`Route · ${route.date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}
        description={route.revisionNumber > 1 ? `Revision ${route.revisionNumber}` : undefined}
        actions={
          <Link href={`/driver/${route.id}`}>
            <Button variant="outline">
              <Truck size={16} /> Open driver view
            </Button>
          </Link>
        }
      />

      {route.awaitingDriverLocation && <div className="mb-6 space-y-3 rounded-lg border border-border bg-surface-alt p-4"><p className="text-sm">These delivery stops were collected automatically from confirmed WhatsApp orders. Use the driver’s current location to calculate road distances and the visiting order.</p><PlanFromLocation routeId={route.id}/></div>}
      {route.usedDevFallback && (
        <div className="mb-4 rounded-lg bg-accent-soft px-4 py-2 text-sm text-accent-hover">
          <strong>Estimated distances:</strong> the road-routing service (OSRM) was unreachable, so this
          route was ordered by straight-line distance — the stop order and ETAs are approximate. It will
          use real road data automatically on the next optimize when the service is available.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total stops" value={route.stops.length} />
        <Stat label="Est. distance" value={`${route.plannedDistanceKm?.toFixed(1) ?? "—"} km`} />
        <Stat label="Est. driving time" value={`${route.plannedDurationMinutes ?? "—"} min`} />
        <Stat
          label="Est. completion"
          value={lastStop?.estimatedArrival ? formatBusinessTime(lastStop.estimatedArrival) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <RouteMap returnToStart={route.returnToStart} routeId={route.awaitingDriverLocation ? undefined : route.id} start={{ lat: route.startLocationLat, lng: route.startLocationLng }} stops={mapStops} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <RouteStopList startLabel={route.awaitingDriverLocation ? "Starting point pending driver GPS" : "Route starting point"} stops={stopViews} />
          </CardContent>
        </Card>
      </div>

      {canReoptimize && (
        <div className="mt-6">
          <ReoptimizePanel routeId={route.id} availableOrders={availableOrders} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <p className="font-display text-xl text-ink">{value}</p>
        <p className="text-xs text-ink-muted">{label}</p>
      </CardContent>
    </Card>
  );
}

import { PlanFromLocation } from "@/components/driver/PlanFromLocation";
import { DriverRouteView, type DriverStopView } from "@/components/driver/DriverRouteView";
import { getDriverRouteForDate } from "@/lib/services/driver";
import { formatBusinessTime } from "@/lib/tz";

export default async function DriverHomePage() {
  const route = await getDriverRouteForDate();

  if (!route) {
    return (
      <div className="space-y-4"><h2 className="font-display text-2xl">Ready for your round?</h2><p className="text-sm text-ink-muted">Plan today’s confirmed orders from where you are now.</p><PlanFromLocation /></div>
    );
  }

  const stops: DriverStopView[] = route.stops.map((stop) => ({
    id: stop.id,
    stopNumber: stop.stopNumber,
    customerName: stop.customerNameSnapshot,
    customerPhone: stop.order.customer.phone,
    customerEmail: stop.order.customer.email,
    product: "A2 milk",
    area: stop.order.address.area,
    address: stop.addressTextSnapshot,
    quantity: stop.quantitySnapshot,
    status: stop.status,
    estimatedArrival: stop.estimatedArrival ? formatBusinessTime(stop.estimatedArrival) : null,
    latitude: stop.latitudeSnapshot,
    longitude: stop.longitudeSnapshot,
  }));

  return <DriverRouteView awaitingDriverLocation={route.awaitingDriverLocation} routeId={route.id} routeStatus={route.status} stops={stops} />;
}

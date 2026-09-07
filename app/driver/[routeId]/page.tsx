import { DriverRouteView, type DriverStopView } from "@/components/driver/DriverRouteView";
import { getRouteDetail } from "@/lib/services/routes";
import { formatBusinessTime } from "@/lib/tz";
import { getOrNotFound } from "@/lib/notFoundGuard";

export default async function DriverRoutePage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const route = await getOrNotFound(() => getRouteDetail(routeId));

  const stops: DriverStopView[] = route.stops.map((stop) => ({
    id: stop.id,
    stopNumber: stop.stopNumber,
    customerName: stop.customerNameSnapshot,
    customerPhone: stop.order.customer.phone,
    area: stop.order.address.area,
    address: stop.addressTextSnapshot,
    quantity: stop.quantitySnapshot,
    status: stop.status,
    estimatedArrival: stop.estimatedArrival ? formatBusinessTime(stop.estimatedArrival) : null,
    latitude: stop.latitudeSnapshot,
    longitude: stop.longitudeSnapshot,
  }));

  return <DriverRouteView routeId={route.id} routeStatus={route.status} stops={stops} />;
}

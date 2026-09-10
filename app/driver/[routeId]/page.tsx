import { notFound } from "next/navigation";
import { DriverRouteView, type DriverStopView } from "@/components/driver/DriverRouteView";
import { getRouteDetail } from "@/lib/services/routes";
import { getOptionalUser } from "@/lib/auth/guard";
import { formatBusinessTime } from "@/lib/tz";
import { getOrNotFound } from "@/lib/notFoundGuard";

export default async function DriverRoutePage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const route = await getOrNotFound(() => getRouteDetail(routeId));

  // A driver may only open an unassigned (claimable) or own round; the owner
  // sees every round. Treat another driver's round as not found here.
  const user = await getOptionalUser();
  if (user?.role === "DRIVER" && route.driverId && route.driverId !== user.userId) notFound();

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

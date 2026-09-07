import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RouteOptimizerPanel, type RoutableOrder } from "@/components/routes/RouteOptimizerPanel";
import { getActiveRouteForDate, listRoutableOrdersForDate } from "@/lib/services/routes";
import { getDefaultStartLocation } from "@/lib/services/settings";
import { todayBusinessDateString } from "@/lib/tz";
import { MILK_SIZE_LABEL } from "@/lib/statusStyles";

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ orderIds?: string }>;
}) {
  const { orderIds } = await searchParams;
  const today = todayBusinessDateString();

  const [activeRoute, routableOrders, defaultStart] = await Promise.all([
    getActiveRouteForDate(today),
    listRoutableOrdersForDate(today),
    getDefaultStartLocation(),
  ]);

  const orders: RoutableOrder[] = routableOrders.map((o) => ({
    id: o.id,
    customerName: o.customer.name,
    area: o.address.area,
    quantity: `${o.quantity}× ${MILK_SIZE_LABEL[o.milkSize] ?? o.milkSize}`,
  }));

  const preselectedIds = (orderIds ?? "").split(",").filter(Boolean);

  return (
    <div>
      <PageHeader title="Routes" description="Optimize and review the driver's delivery route." />

      {activeRoute && (
        <Link href={`/routes/${activeRoute.id}`}>
          <Card className="mb-6 hover:border-primary/40">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">
                  Today&rsquo;s route is {activeRoute.status === "IN_PROGRESS" ? "in progress" : "planned"}
                </p>
                <p className="text-sm text-ink-muted">
                  {activeRoute.stops.length} stops · {activeRoute.plannedDistanceKm?.toFixed(1)} km ·{" "}
                  {activeRoute.plannedDurationMinutes} min
                </p>
              </div>
              <Badge tone={activeRoute.status === "IN_PROGRESS" ? "transit" : "confirmed"}>
                {activeRoute.status === "IN_PROGRESS" ? "In progress" : "Planned"}
              </Badge>
            </CardContent>
          </Card>
        </Link>
      )}

      <p className="mb-3 text-sm font-medium text-ink">
        {activeRoute ? "Plan another route" : "Plan today's route"}
      </p>
      <RouteOptimizerPanel
        orders={orders}
        preselectedIds={preselectedIds}
        defaultStart={{ lat: defaultStart.latitude, lng: defaultStart.longitude, label: defaultStart.label }}
      />
    </div>
  );
}

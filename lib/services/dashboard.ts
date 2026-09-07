import { db } from "@/lib/db";
import { businessDateOnlyToDate, todayBusinessDateString } from "@/lib/tz";

export async function getDashboardSummary() {
  const today = businessDateOnlyToDate(todayBusinessDateString());

  const orders = await db.order.findMany({
    where: { deliveryDate: today },
    select: { status: true, milkSize: true, quantity: true, total: true, customQuantityLiters: true },
  });

  const confirmed = orders.filter((o) => o.status === "CONFIRMED" || o.status === "OUT_FOR_DELIVERY").length;
  const pending = orders.filter((o) => o.status === "PENDING").length;
  const delivered = orders.filter((o) => o.status === "DELIVERED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;

  const revenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const ml500 = orders.filter((o) => o.milkSize === "ML500").reduce((sum, o) => sum + o.quantity, 0);
  const l1 = orders.filter((o) => o.milkSize === "L1").reduce((sum, o) => sum + o.quantity, 0);

  const route = await db.route.findFirst({
    where: { date: today, status: { in: ["PLANNED", "IN_PROGRESS"] } },
    orderBy: { revisionNumber: "desc" },
    include: { stops: true },
  });

  return {
    today,
    orders: { total: orders.length, confirmed, pending, delivered, cancelled },
    revenue,
    milk: { ml500, l1 },
    route: route
      ? {
          totalStops: route.stops.length,
          plannedDistanceKm: route.plannedDistanceKm,
          plannedDurationMinutes: route.plannedDurationMinutes,
          status: route.status,
        }
      : null,
  };
}

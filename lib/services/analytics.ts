import { db } from "@/lib/db";
import { businessDateOnlyToDate } from "@/lib/tz";

export interface AnalyticsSummary {
  orders: { total: number; delivered: number; cancelled: number };
  milk: { ml500Units: number; l1Units: number; totalLitres: number };
  revenue: number;
  distance: { totalKm: number; avgKmPerDelivery: number; totalDrivingMinutes: number };
  ordersByArea: Array<{ area: string; orders: number }>;
  customersByArea: Array<{ area: string; customers: number }>;
}

export async function getAnalyticsSummary(fromDateString: string, toDateString: string): Promise<AnalyticsSummary> {
  const from = businessDateOnlyToDate(fromDateString);
  const to = businessDateOnlyToDate(toDateString);

  const orders = await db.order.findMany({
    where: { deliveryDate: { gte: from, lte: to } },
    include: { address: true },
  });

  const delivered = orders.filter((o) => o.status === "DELIVERED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");

  const ml500Units = delivered.filter((o) => o.milkSize === "ML500").reduce((sum, o) => sum + o.quantity, 0);
  const l1Units = delivered.filter((o) => o.milkSize === "L1").reduce((sum, o) => sum + o.quantity, 0);
  const customUnits = delivered.filter((o) => o.milkSize === "CUSTOM");
  const totalLitres =
    ml500Units * 0.5 + l1Units * 1 + customUnits.reduce((sum, o) => sum + (o.customQuantityLiters ?? 0) * o.quantity, 0);

  const revenue = delivered.reduce((sum, o) => sum + Number(o.total), 0);

  const routes = await db.route.findMany({
    where: { date: { gte: from, lte: to }, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
  });
  const totalKm = routes.reduce((sum, r) => sum + (r.plannedDistanceKm ?? 0), 0);
  const totalDrivingMinutes = routes.reduce((sum, r) => sum + (r.plannedDurationMinutes ?? 0), 0);
  const avgKmPerDelivery = delivered.length > 0 ? totalKm / delivered.length : 0;

  const areaOrderCounts = new Map<string, number>();
  for (const o of orders) {
    const area = o.address.area ?? "Unspecified";
    areaOrderCounts.set(area, (areaOrderCounts.get(area) ?? 0) + 1);
  }
  const ordersByArea = [...areaOrderCounts.entries()]
    .map(([area, count]) => ({ area, orders: count }))
    .sort((a, b) => b.orders - a.orders);

  const customersByAreaRaw = await db.address.findMany({
    where: { customerId: { not: null } },
    select: { area: true, customerId: true },
  });
  const areaCustomerSets = new Map<string, Set<string>>();
  for (const row of customersByAreaRaw) {
    const area = row.area ?? "Unspecified";
    if (!areaCustomerSets.has(area)) areaCustomerSets.set(area, new Set());
    areaCustomerSets.get(area)!.add(row.customerId!);
  }
  const customersByArea = [...areaCustomerSets.entries()]
    .map(([area, set]) => ({ area, customers: set.size }))
    .sort((a, b) => b.customers - a.customers);

  return {
    orders: { total: orders.length, delivered: delivered.length, cancelled: cancelled.length },
    milk: { ml500Units, l1Units, totalLitres },
    revenue,
    distance: { totalKm, avgKmPerDelivery, totalDrivingMinutes },
    ordersByArea,
    customersByArea,
  };
}

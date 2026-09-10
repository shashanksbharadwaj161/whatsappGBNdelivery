import { db } from "@/lib/db";
import { businessDateOnlyToDate, todayBusinessDateString } from "@/lib/tz";
import type { RouteActor } from "@/lib/services/routes";

export async function getDriverRouteForDate(
  dateString: string = todayBusinessDateString(),
  actor?: RouteActor
) {
  // A driver only ever lands on a round that is unassigned (claimable) or
  // already theirs; the owner sees whichever round is active for the date.
  const driverScope =
    actor && actor.role === "DRIVER"
      ? { OR: [{ driverId: null }, { driverId: actor.userId }] }
      : {};
  return db.route.findFirst({
    where: { date: businessDateOnlyToDate(dateString), status: { in: ["PLANNED", "IN_PROGRESS"] }, ...driverScope },
    orderBy: [{ revisionNumber: "desc" }, { createdAt: "asc" }],
    include: {
      stops: {
        orderBy: { stopNumber: "asc" },
        include: { order: { include: { customer: true, address: true } } },
      },
    },
  });
}

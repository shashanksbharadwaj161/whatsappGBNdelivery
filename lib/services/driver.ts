import { db } from "@/lib/db";
import { businessDateOnlyToDate, todayBusinessDateString } from "@/lib/tz";

export async function getDriverRouteForDate(dateString: string = todayBusinessDateString()) {
  return db.route.findFirst({
    where: { date: businessDateOnlyToDate(dateString), status: { in: ["PLANNED", "IN_PROGRESS"] } },
    orderBy: { revisionNumber: "desc" },
    include: {
      stops: {
        orderBy: { stopNumber: "asc" },
        include: { order: { include: { customer: true, address: true } } },
      },
    },
  });
}

/**
 * End-to-end verification of the core loop: WhatsApp -> Order -> Location
 * -> Optimized Route -> Delivered. Exercises the real service layer
 * against the database (not mocks), asserting DB state at each step.
 *
 * Run `npm run verify:webhook` first in another terminal (or by hand)
 * to POST the matching simulated webhook payload, then:
 *   npx tsx scripts/traceability-gate.ts
 *
 * Creates and then leaves in place one demo customer/order/route under
 * phone +919845077777 ("Traceability Test Lead") so the result is
 * inspectable afterward — delete it manually if you want a clean seed
 * baseline again.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

async function main() {
  const { db } = await import("@/lib/db");
  const { createAddress } = await import("@/lib/services/addresses");
  const ordersService = await import("@/lib/services/orders");
  const routesService = await import("@/lib/services/routes");
  const routeStopsService = await import("@/lib/services/routeStops");
  const { getDefaultStartLocation } = await import("@/lib/services/settings");

  const conversation = await db.whatsappConversation.findUniqueOrThrow({ where: { waId: "919845077777" } });
  console.log("STEP 1 (verified above via curl): conversation", conversation.id, "unread:", conversation.unreadCount);

  // STEP 2: "Create Order" from this conversation.
  const customer = await db.customer.upsert({
    where: { phone: "+919845077777" },
    update: {},
    create: { name: "Traceability Test Lead", phone: "+919845077777" },
  });
  const address = await createAddress({
    formattedAddress: "12th Cross, Abbigere, Bengaluru 560090",
    latitude: 13.0678,
    longitude: 77.5157,
    area: "Abbigere",
    source: "TYPED",
    rawInput: "Hi, I want 1 litre milk daily. I'm near Abbigere, Bengaluru.",
    customerId: customer.id,
  });
  const order = await ordersService.createOrder({
    customerId: customer.id,
    addressId: address.id,
    conversationId: conversation.id,
    milkSize: "L1",
    quantity: 1,
    orderType: "DAILY_SUBSCRIPTION",
    source: "WHATSAPP",
    deliveryDate: new Date().toISOString().slice(0, 10),
    deliveryWindow: "MORNING",
  });
  console.log("STEP 2: order created", order.id, "status:", order.status, "source:", order.source, "lat/lng:", address.latitude, address.longitude);

  // STEP 3: Confirm.
  const confirmed = await ordersService.confirmOrder(order.id);
  console.log("STEP 3: order confirmed, status:", confirmed.status);

  // STEP 4: Optimize route (route optimization -> persisted Route/RouteStop).
  const start = await getDefaultStartLocation();
  const route = await routesService.createOptimizedRoute({
    orderIds: [order.id],
    startLat: start.latitude,
    startLng: start.longitude,
    startTime: new Date(),
  });
  console.log(
    "STEP 4: route created",
    route.id,
    "stops:",
    route.stops.length,
    "stop snapshot lat/lng:",
    route.stops[0].latitudeSnapshot,
    route.stops[0].longitudeSnapshot
  );

  // STEP 5: Driver starts route, marks the stop delivered.
  await routeStopsService.startRoute(route.id);
  const orderAfterStart = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  console.log("STEP 5a: route started, order status now:", orderAfterStart.status);

  const deliveredStop = await routeStopsService.updateStopStatus({ stopId: route.stops[0].id, status: "DELIVERED" });
  console.log("STEP 5b: stop marked", deliveredStop.status, "deliveredAt:", deliveredStop.deliveredAt);

  const finalOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  const finalRoute = await db.route.findUniqueOrThrow({ where: { id: route.id } });
  console.log("STEP 6: final order status:", finalOrder.status, "| final route status:", finalRoute.status, "completedAt:", finalRoute.completedAt);

  // Full audit trail for this order + route + stop.
  const auditEntries = await db.auditLog.findMany({
    where: { entityId: { in: [customer.id, order.id, route.id, route.stops[0].id] } },
    orderBy: { createdAt: "asc" },
  });
  console.log(
    "\nFull audit trail:",
    auditEntries.map((a) => a.action)
  );

  const allGood =
    orderAfterStart.status === "OUT_FOR_DELIVERY" &&
    deliveredStop.status === "DELIVERED" &&
    finalOrder.status === "DELIVERED" &&
    finalRoute.status === "COMPLETED";

  console.log(allGood ? "\n✅ TRACEABILITY GATE PASSED" : "\n❌ TRACEABILITY GATE FAILED");

  await db.$disconnect();
  if (!allGood) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

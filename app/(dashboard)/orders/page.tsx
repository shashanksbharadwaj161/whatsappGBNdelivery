import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { OrderTabs, type OrderTabKey } from "@/components/orders/OrderTabs";
import { OrderTable, type OrderRow } from "@/components/orders/OrderTable";
import { listOrders } from "@/lib/services/orders";
import { hasCoordinates } from "@/lib/services/addresses";
import { todayBusinessDateString, addDaysToBusinessDateString } from "@/lib/tz";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = (tabParam ?? "today") as OrderTabKey;

  const today = todayBusinessDateString();
  const tomorrow = addDaysToBusinessDateString(today, 1);

  const orders = await listOrders(
    tab === "today"
      ? { deliveryDateFrom: today, deliveryDateTo: today, status: ["PENDING", "CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED"] }
      : tab === "tomorrow"
        ? { deliveryDateFrom: tomorrow, deliveryDateTo: tomorrow, status: ["PENDING", "CONFIRMED"] }
        : tab === "upcoming"
          ? { deliveryDateFrom: addDaysToBusinessDateString(tomorrow, 1), status: ["PENDING", "CONFIRMED"] }
          : tab === "subscriptions"
            ? { subscriptionOnly: true, deliveryDateFrom: today, status: ["PENDING", "CONFIRMED"] }
            : tab === "delivered"
              ? { status: ["DELIVERED"] }
              : { status: ["CANCELLED"] }
  );

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    sequenceNumber: o.sequenceNumber,
    customerName: o.customer.name,
    area: o.address.area,
    formattedAddress: o.address.formattedAddress,
    milkSize: o.milkSize,
    quantity: o.quantity,
    deliveryWindow: o.deliveryWindow === "MORNING" ? "Morning" : `${o.customWindowStart ?? ""}-${o.customWindowEnd ?? ""}`,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: Number(o.total),
    hasCoordinates: hasCoordinates(o.address),
  }));

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Today, tomorrow, and upcoming deliveries."
        actions={
          <Link href="/orders/new">
            <Button>
              <Plus size={16} /> New order
            </Button>
          </Link>
        }
      />
      <OrderTabs active={tab} />
      <OrderTable orders={rows} selectable={tab === "today"} />
    </div>
  );
}

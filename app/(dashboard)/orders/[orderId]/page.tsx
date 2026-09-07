import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OrderActions } from "@/components/orders/OrderActions";
import { getOrderDetail } from "@/lib/services/orders";
import { hasCoordinates } from "@/lib/services/addresses";
import { ORDER_STATUS_STYLE, PAYMENT_STATUS_STYLE, MILK_SIZE_LABEL } from "@/lib/statusStyles";
import { getOrNotFound } from "@/lib/notFoundGuard";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrNotFound(() => getOrderDetail(orderId));
  const statusStyle = ORDER_STATUS_STYLE[order.status];
  const paymentStyle = PAYMENT_STATUS_STYLE[order.paymentStatus];

  return (
    <div>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to orders
      </Link>
      <PageHeader
        title={`GBN-${String(order.sequenceNumber).padStart(6, "0")}`}
        description={order.deliveryDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <>
            <Badge tone={statusStyle.tone}>{statusStyle.label}</Badge>
            <Badge tone={paymentStyle.tone}>{paymentStyle.label}</Badge>
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Customer">
              <Link href={`/customers/${order.customerId}`} className="text-primary hover:underline">
                {order.customer.name}
              </Link>{" "}
              · {order.customer.phone}
            </Row>
            <Row label="Quantity">
              {order.quantity}× {MILK_SIZE_LABEL[order.milkSize]}
              {order.milkSize === "CUSTOM" && ` (${order.customQuantityLiters} L each)`}
            </Row>
            <Row label="Order type">{order.orderType.replace(/_/g, " ")}</Row>
            <Row label="Source">{order.source}</Row>
            <Row label="Delivery window">
              {order.deliveryWindow === "MORNING" ? "Morning" : `${order.customWindowStart}–${order.customWindowEnd}`}
            </Row>
            <Row label="Notes">{order.deliveryNotes || "—"}</Row>
            <Row label="Pricing">
              ₹{Number(order.unitPrice).toFixed(0)} × {order.quantity} + ₹{Number(order.deliveryFee).toFixed(0)}{" "}
              delivery = <span className="font-medium text-ink">₹{Number(order.total).toFixed(0)}</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Address">{order.address.formattedAddress}</Row>
            <Row label="Landmark">{order.address.landmark || "—"}</Row>
            <Row label="Coordinates">
              {hasCoordinates(order.address)
                ? `${order.address.latitude?.toFixed(6)}, ${order.address.longitude?.toFixed(6)}`
                : "Not resolved yet"}
            </Row>
            {order.activeRouteStop && (
              <Row label="Route">
                <Link href={`/routes/${order.activeRouteStop.routeId}`} className="text-primary hover:underline">
                  Stop #{order.activeRouteStop.stopNumber} on today&rsquo;s route
                </Link>
              </Row>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <OrderActions orderId={order.id} status={order.status} hasCoordinates={hasCoordinates(order.address)} />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-ink-muted">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

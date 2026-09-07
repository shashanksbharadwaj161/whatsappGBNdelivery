import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getCustomerDetail } from "@/lib/services/customers";
import { ORDER_STATUS_STYLE, MILK_SIZE_LABEL } from "@/lib/statusStyles";
import { SubscriptionsPanel, type SubscriptionView } from "@/components/customers/SubscriptionsPanel";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const { customer, stats } = await getCustomerDetail(customerId);

  return (
    <div>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to customers
      </Link>
      <PageHeader title={customer.name} description={customer.phone} />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Total litres</p>
            <p className="mt-1 font-display text-xl text-ink">{stats.totalLitres.toFixed(1)} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Total spent</p>
            <p className="mt-1 font-display text-xl text-ink">₹{stats.totalSpent.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Last delivery</p>
            <p className="mt-1 font-display text-xl text-ink">
              {stats.lastDelivery ? stats.lastDelivery.toLocaleDateString("en-IN") : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-ink-muted">Subscription</p>
            <p className="mt-1 font-display text-xl text-ink">
              {stats.activeSubscription ? "Active" : "None"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order history</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Quantity</th>
                    <th className="py-2 pr-4">Address</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customer.orders.map((order) => {
                    const style = ORDER_STATUS_STYLE[order.status];
                    return (
                      <tr key={order.id}>
                        <td className="py-2 pr-4">
                          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                            {order.deliveryDate.toLocaleDateString("en-IN")}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          {order.quantity}× {MILK_SIZE_LABEL[order.milkSize]}
                        </td>
                        <td className="py-2 pr-4 text-ink-muted">{order.address.formattedAddress}</td>
                        <td className="py-2 pr-4">
                          <Badge tone={style.tone}>{style.label}</Badge>
                        </td>
                        <td className="py-2 pr-4">₹{Number(order.total).toFixed(0)}</td>
                      </tr>
                    );
                  })}
                  {customer.orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-muted">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <SubscriptionsPanel
          customerId={customer.id}
          defaultAddressId={customer.defaultAddressId}
          subscriptions={customer.subscriptions.map(
            (s): SubscriptionView => ({
              id: s.id,
              milkSize: s.milkSize,
              quantity: s.quantity,
              frequency: s.frequency,
              status: s.status,
              address: s.address.formattedAddress,
              startDate: s.startDate.toLocaleDateString("en-IN"),
            })
          )}
        />
      </div>
    </div>
  );
}

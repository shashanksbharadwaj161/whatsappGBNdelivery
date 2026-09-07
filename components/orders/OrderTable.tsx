"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ORDER_STATUS_STYLE, PAYMENT_STATUS_STYLE, MILK_SIZE_LABEL } from "@/lib/statusStyles";

export interface OrderRow {
  id: string;
  sequenceNumber: number;
  customerName: string;
  area: string | null;
  formattedAddress: string;
  milkSize: string;
  quantity: number;
  deliveryWindow: string;
  status: keyof typeof ORDER_STATUS_STYLE;
  paymentStatus: keyof typeof PAYMENT_STATUS_STYLE;
  total: number;
  hasCoordinates: boolean;
}

export function OrderTable({ orders, selectable = false }: { orders: OrderRow[]; selectable?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function optimizeSelected() {
    const ids = Array.from(selected);
    router.push(`/routes?orderIds=${ids.join(",")}`);
  }

  const selectableOrders = orders.filter((o) => o.status === "CONFIRMED" && o.hasCoordinates);

  return (
    <div>
      {selectable && selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-primary-soft px-4 py-2">
          <p className="text-sm text-primary">{selected.size} order(s) selected</p>
          <Button size="sm" onClick={optimizeSelected}>
            Optimize selected route
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            <tr>
              {selectable && <th className="w-10 px-4 py-3" />}
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const statusStyle = ORDER_STATUS_STYLE[order.status];
              const paymentStyle = PAYMENT_STATUS_STYLE[order.paymentStatus];
              const canSelect = order.status === "CONFIRMED" && order.hasCoordinates;
              return (
                <tr key={order.id} className="hover:bg-surface-alt/50">
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!canSelect}
                        checked={selected.has(order.id)}
                        onChange={() => toggle(order.id)}
                        className="h-4 w-4 rounded border-border accent-primary disabled:opacity-30"
                        title={!canSelect ? "Only confirmed orders with a resolved address can be routed" : undefined}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                      GBN-{String(order.sequenceNumber).padStart(6, "0")}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customerName}</td>
                  <td className="px-4 py-3 text-ink-muted">{order.area ?? order.formattedAddress}</td>
                  <td className="px-4 py-3">
                    {order.quantity}× {MILK_SIZE_LABEL[order.milkSize] ?? order.milkSize}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{order.deliveryWindow}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusStyle.tone}>{statusStyle.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={paymentStyle.tone}>{paymentStyle.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">₹{order.total.toFixed(0)}</td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={selectable ? 9 : 8} className="px-4 py-8 text-center text-ink-muted">
                  No orders in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectable && selectableOrders.length === 0 && orders.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          No orders here are ready to route yet — confirm them and make sure their address has a resolved location.
        </p>
      )}
    </div>
  );
}

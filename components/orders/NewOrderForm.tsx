"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { createOrderAction } from "@/lib/actions/orders";
import { todayBusinessDateString } from "@/lib/tz";
import type { DeliveryWindow, MilkSize, OrderType, PaymentStatus } from "@prisma/client";

export function NewOrderForm({
  prefill,
}: {
  prefill?: { customerName?: string; phone?: string; conversationId?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState(prefill?.customerName ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [milkSize, setMilkSize] = useState<MilkSize>("L1");
  const [customQuantityLiters, setCustomQuantityLiters] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("ONE_TIME");
  const [deliveryDate, setDeliveryDate] = useState(todayBusinessDateString());
  const [deliveryWindow, setDeliveryWindow] = useState<DeliveryWindow>("MORNING");
  const [customWindowStart, setCustomWindowStart] = useState("");
  const [customWindowEnd, setCustomWindowEnd] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDING");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const order = await createOrderAction({
          customer: { name: customerName, phone },
          address: {
            formattedAddress,
            landmark: landmark || null,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            source: "TYPED",
            rawInput: formattedAddress,
          },
          milkSize,
          customQuantityLiters: milkSize === "CUSTOM" ? Number(customQuantityLiters) : null,
          quantity: Number(quantity),
          orderType,
          source: prefill?.conversationId ? "WHATSAPP" : "MANUAL",
          conversationId: prefill?.conversationId ?? null,
          deliveryDate,
          deliveryWindow,
          customWindowStart: deliveryWindow === "CUSTOM" ? customWindowStart : null,
          customWindowEnd: deliveryWindow === "CUSTOM" ? customWindowEnd : null,
          deliveryNotes: deliveryNotes || null,
          googleMapsUrl: googleMapsUrl || null,
          paymentStatus,
        });
        router.push(`/orders/${order.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create order");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-4">
          <p className="font-medium text-ink">Customer</p>
          <div>
            <Label htmlFor="customerName">Name</Label>
            <Input id="customerName" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" required placeholder="+91 98xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <p className="pt-2 font-medium text-ink">Delivery</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="milkSize">Milk quantity</Label>
              <Select id="milkSize" value={milkSize} onChange={(e) => setMilkSize(e.target.value as MilkSize)}>
                <option value="ML500">500 ml</option>
                <option value="L1">1 Litre</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Units</Label>
              <Input id="quantity" type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          {milkSize === "CUSTOM" && (
            <div>
              <Label htmlFor="customQty">Custom quantity (litres per unit)</Label>
              <Input
                id="customQty"
                type="number"
                step="0.1"
                min={0.1}
                required
                value={customQuantityLiters}
                onChange={(e) => setCustomQuantityLiters(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label htmlFor="orderType">Order type</Label>
            <Select id="orderType" value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}>
              <option value="ONE_TIME">One-time</option>
              <option value="TRIAL">Trial</option>
              <option value="DAILY_SUBSCRIPTION">Daily subscription</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="deliveryDate">Delivery date</Label>
              <Input
                id="deliveryDate"
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deliveryWindow">Delivery window</Label>
              <Select id="deliveryWindow" value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value as DeliveryWindow)}>
                <option value="MORNING">Morning</option>
                <option value="CUSTOM">Custom time</option>
              </Select>
            </div>
          </div>
          {deliveryWindow === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="windowStart">From</Label>
                <Input id="windowStart" type="time" value={customWindowStart} onChange={(e) => setCustomWindowStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="windowEnd">To</Label>
                <Input id="windowEnd" type="time" value={customWindowEnd} onChange={(e) => setCustomWindowEnd(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="paymentStatus">Payment status</Label>
            <Select id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="font-medium text-ink">Address</p>
          <p className="text-xs text-ink-muted">
            Places autocomplete, Maps URL parsing, and pin-drop are wired up in Phase 3 — for now, enter
            the address and coordinates directly if known.
          </p>
          <div>
            <Label htmlFor="formattedAddress">Address</Label>
            <Textarea
              id="formattedAddress"
              required
              value={formattedAddress}
              onChange={(e) => setFormattedAddress(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="landmark">Landmark</Label>
            <Input id="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="googleMapsUrl">Google Maps URL (optional)</Label>
            <Input id="googleMapsUrl" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="deliveryNotes">Delivery notes</Label>
            <Textarea id="deliveryNotes" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-status-cancelled">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create order"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

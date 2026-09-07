"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { AddressAutocompleteInput } from "@/components/maps/AddressAutocompleteInput";
import { LocationPinDropMap } from "@/components/maps/LocationPinDropMap";
import { createOrderAction } from "@/lib/actions/orders";
import { getDeliveryEconomicsAction } from "@/lib/actions/deliveryEconomics";
import { todayBusinessDateString } from "@/lib/tz";
import type { DeliveryWindow, MilkSize, OrderType, PaymentStatus, AddressSource } from "@prisma/client";
import type { DeliveryEconomics } from "@/lib/services/deliveryEconomics";

const DEFAULT_MAP_CENTER = { lat: 13.067, lng: 77.556 }; // north Bengaluru — see Settings for the real base

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
  const [area, setArea] = useState<string | null>(null);
  const [addressSource, setAddressSource] = useState<AddressSource>("TYPED");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [economics, setEconomics] = useState<DeliveryEconomics | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDING");

  const applyLocation = useCallback(
    (loc: { formattedAddress?: string; latitude: number; longitude: number; area?: string | null }, source: AddressSource) => {
      if (loc.formattedAddress) setFormattedAddress(loc.formattedAddress);
      setLatitude(String(loc.latitude));
      setLongitude(String(loc.longitude));
      if (loc.area) setArea(loc.area);
      setAddressSource(source);
    },
    []
  );

  async function handleResolveMapsUrl() {
    if (!googleMapsUrl.trim()) return;
    setResolvingUrl(true);
    setResolveError(null);
    try {
      const res = await fetch("/api/maps-url/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: googleMapsUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error?.message ?? "Could not resolve this link");
        return;
      }
      applyLocation(data, "MAPS_URL");
    } catch {
      setResolveError("Could not reach the server");
    } finally {
      setResolvingUrl(false);
    }
  }

  async function handleGeocodeAddress() {
    if (!formattedAddress.trim()) return;
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: formattedAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeocodeError(data.error?.message ?? "Could not find this address");
        return;
      }
      applyLocation(data, "TYPED");
    } catch {
      setGeocodeError("Could not reach the server");
    } finally {
      setGeocoding(false);
    }
  }

  function handlePinChange(position: { lat: number; lng: number }) {
    setLatitude(String(position.lat));
    setLongitude(String(position.lng));
    setAddressSource("MANUAL_PIN");
  }

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude || !longitude || Number.isNaN(lat) || Number.isNaN(lng) || !deliveryDate) {
      return;
    }
    let cancelled = false;
    getDeliveryEconomicsAction(lat, lng, deliveryDate).then((result) => {
      if (!cancelled) setEconomics(result);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, deliveryDate]);

  const hasCoordinates = Boolean(latitude && longitude && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude)));

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
            area,
            source: addressSource,
            rawInput: addressSource === "MAPS_URL" ? googleMapsUrl : formattedAddress,
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

          <div>
            <Label htmlFor="googleMapsUrl">Google Maps link (from WhatsApp)</Label>
            <div className="flex gap-2">
              <Input
                id="googleMapsUrl"
                placeholder="https://maps.app.goo.gl/..."
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
              />
              <Button type="button" variant="outline" disabled={resolvingUrl || !googleMapsUrl.trim()} onClick={handleResolveMapsUrl}>
                <Link2 size={14} /> {resolvingUrl ? "Resolving…" : "Resolve"}
              </Button>
            </div>
            {resolveError && <p className="mt-1 text-xs text-status-cancelled">{resolveError}</p>}
          </div>

          <div>
            <Label htmlFor="formattedAddress">Address</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <AddressAutocompleteInput
                  id="formattedAddress"
                  required
                  value={formattedAddress}
                  onChange={setFormattedAddress}
                  onPlaceSelected={(place) => applyLocation(place, "TYPED")}
                />
              </div>
              <Button type="button" variant="outline" disabled={geocoding || !formattedAddress.trim()} onClick={handleGeocodeAddress}>
                <MapPin size={14} /> {geocoding ? "Looking up…" : "Look up"}
              </Button>
            </div>
            {geocodeError && <p className="mt-1 text-xs text-status-cancelled">{geocodeError}</p>}
          </div>

          <div>
            <Label htmlFor="landmark">Landmark</Label>
            <Input id="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
          </div>

          <div>
            <Label>Pin on map</Label>
            <LocationPinDropMap
              latitude={latitude ? Number(latitude) : null}
              longitude={longitude ? Number(longitude) : null}
              defaultCenter={DEFAULT_MAP_CENTER}
              onPinChange={handlePinChange}
            />
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

          {economics && hasCoordinates && (
            <div className="rounded-lg bg-surface-alt px-3 py-2 text-xs text-ink-muted">
              <p className="font-medium text-ink">Is this delivery economical?</p>
              <p className="mt-1">
                Nearest of {economics.existingStopCount} confirmed stop{economics.existingStopCount === 1 ? "" : "s"}{" "}
                today: <span className="font-medium text-ink">{economics.nearestStopKm.toFixed(1)} km</span> away
                {economics.nearestStopKm > 5 && " — this looks well outside today's delivery zone."}
              </p>
            </div>
          )}

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

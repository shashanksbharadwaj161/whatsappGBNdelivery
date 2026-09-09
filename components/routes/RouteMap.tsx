"use client";

import { createDeliveryPopup, type DeliveryDetails } from "@/components/maps/popup";
import { useRoadGeometry } from "@/lib/maps/useRoadGeometry";
import { useEffect, useRef } from "react";
import { useGoogleMapsScript } from "@/lib/maps/useGoogleMapsScript";
import { LeafletMap, type LeafletMarker } from "@/components/maps/LeafletMap";

export interface RouteMapStop {
  id: string;
  stopNumber: number;
  lat: number;
  lng: number;
  status: "PENDING" | "EN_ROUTE" | "DELIVERED" | "SKIPPED" | "UNAVAILABLE";
  customerName: string;
  details?: DeliveryDetails;
}

export const PIN_COLORS: Record<RouteMapStop["status"], string> = {
  PENDING: "#b8863a",
  EN_ROUTE: "#b5562f",
  DELIVERED: "#1f4b36",
  SKIPPED: "#6b6357",
  UNAVAILABLE: "#a23b3b",
};

export function RouteMap({
  start,
  stops,
  routeId,
  returnToStart = true,
  heightClassName = "h-80",
}: {
  start: { lat: number; lng: number };
  stops: RouteMapStop[];
  routeId?: string;
  returnToStart?: boolean;
  heightClassName?: string;
}) {
  const road = useRoadGeometry(routeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const { configured, loaded, error } = useGoogleMapsScript();

  useEffect(() => {
    if (!configured || !loaded || !containerRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    const map = new google.maps.Map(containerRef.current, {
      center: start,
      zoom: 12,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });

    new google.maps.Marker({
      map,
      position: start,
      label: { text: "S", color: "white" },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#1f4b36", fillOpacity: 1, strokeWeight: 0 },
    });
    bounds.extend(start);

    const path: google.maps.LatLngLiteral[] = [start];
    for (const stop of stops) {
      const position = { lat: stop.lat, lng: stop.lng };
      const marker = new google.maps.Marker({
        map,
        position,
        label: { text: String(stop.stopNumber), color: "white", fontSize: "12px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: PIN_COLORS[stop.status],
          fillOpacity: 1,
          strokeWeight: 0,
        },
        title: `${stop.stopNumber}. ${stop.customerName}`,
      });
      const detail = createDeliveryPopup(`${stop.stopNumber}. ${stop.customerName}`, stop.details);
      const popup = new google.maps.InfoWindow({ content: detail });
      marker.addListener("click", () => popup.open({ map, anchor: marker }));
      bounds.extend(position);
      path.push(position);
    }
    if (returnToStart) path.push(start);

    new google.maps.Polyline({
      map,
      path: road ?? path,
      strokeColor: "#1f4b36",
      strokeOpacity: 0.6,
      strokeWeight: 3,
    });

    if (stops.length > 0) map.fitBounds(bounds, 48);
    return () => { google.maps.event.clearInstanceListeners(map); };
  }, [configured, loaded, start, stops, road, returnToStart]);

  // Google Maps when a key is configured; otherwise the key-free
  // Leaflet/OpenStreetMap map so the route is always visible.
  if (configured && !error) {
    return <div><div ref={containerRef} className={`${heightClassName} w-full rounded-lg border border-border`} /><p className="mt-2 text-xs text-ink-muted">{road ? "OpenStreetMap road preview. Use Navigate for driving directions." : "Lines show stop order only, not driving directions."}</p></div>;
  }

  const markers: LeafletMarker[] = [
    { id: "start", lat: start.lat, lng: start.lng, label: "S", color: "#1f4b36", title: "Route start" },
    ...stops.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      label: String(s.stopNumber),
      color: PIN_COLORS[s.status],
      title: `${s.stopNumber}. ${s.customerName}`,
      details: s.details,
    })),
  ];
  const polyline = [start, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), ...(returnToStart ? [start] : [])];

  return (
    <div>
    <LeafletMap
      center={start}
      markers={markers}
      polyline={road ?? (stops.length > 0 ? polyline : undefined)}
      roadPath={Boolean(road)}
      fitToMarkers
      heightClassName={heightClassName}
    />
    <p className="mt-2 text-xs text-ink-muted">{road ? "OpenStreetMap road preview · Tap a pin for details. Use Navigate for turn-by-turn directions." : "Road preview unavailable. Dashed lines show stop order, not driving directions."}</p>
    </div>
  );
}

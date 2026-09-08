"use client";

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
  heightClassName = "h-64",
}: {
  start: { lat: number; lng: number };
  stops: RouteMapStop[];
  heightClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { configured, loaded } = useGoogleMapsScript();

  useEffect(() => {
    if (!configured || !loaded || !containerRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    const map = new google.maps.Map(containerRef.current, {
      center: start,
      zoom: 12,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
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
      new google.maps.Marker({
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
      bounds.extend(position);
      path.push(position);
    }
    path.push(start);

    new google.maps.Polyline({
      map,
      path,
      strokeColor: "#1f4b36",
      strokeOpacity: 0.6,
      strokeWeight: 3,
    });

    if (stops.length > 0) map.fitBounds(bounds, 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loaded, start.lat, start.lng, stops.length]);

  // Google Maps when a key is configured; otherwise the key-free
  // Leaflet/OpenStreetMap map so the route is always visible.
  if (configured) {
    return <div ref={containerRef} className={`${heightClassName} w-full rounded-lg border border-border`} />;
  }

  const markers: LeafletMarker[] = [
    { id: "start", lat: start.lat, lng: start.lng, label: "S", color: "#1f4b36", title: "Start · Gau Bhoomi Naturals" },
    ...stops.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      label: String(s.stopNumber),
      color: PIN_COLORS[s.status],
      title: `${s.stopNumber}. ${s.customerName}`,
    })),
  ];
  const polyline = [start, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), start];

  return (
    <LeafletMap
      center={start}
      markers={markers}
      polyline={stops.length > 0 ? polyline : undefined}
      fitToMarkers
      heightClassName={heightClassName}
    />
  );
}

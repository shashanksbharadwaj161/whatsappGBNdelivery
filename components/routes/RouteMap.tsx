"use client";

import { useEffect, useRef } from "react";
import { useGoogleMapsScript } from "@/lib/maps/useGoogleMapsScript";

export interface RouteMapStop {
  id: string;
  stopNumber: number;
  lat: number;
  lng: number;
  status: "PENDING" | "EN_ROUTE" | "DELIVERED" | "SKIPPED" | "UNAVAILABLE";
  customerName: string;
}

const PIN_COLORS: Record<RouteMapStop["status"], string> = {
  PENDING: "#b8863a",
  EN_ROUTE: "#b5562f",
  DELIVERED: "#1f4b36",
  SKIPPED: "#6b6357",
  UNAVAILABLE: "#a23b3b",
};

export function RouteMap({
  start,
  stops,
}: {
  start: { lat: number; lng: number };
  stops: RouteMapStop[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { configured, loaded } = useGoogleMapsScript();

  useEffect(() => {
    if (!loaded || !containerRef.current) return;

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
  }, [loaded, start.lat, start.lng, stops.length]);

  if (!configured) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt text-center text-xs text-ink-faint">
        Route map needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — the stop list
        <br />
        below has the full route order, distances, and ETAs.
      </div>
    );
  }

  return <div ref={containerRef} className="h-64 w-full rounded-lg border border-border" />;
}

"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as LType from "leaflet";

export interface LeafletMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string; // shown inside the pin (e.g. stop number, "S")
  color?: string; // pin fill; defaults to brand green
  title?: string; // popup / tooltip text
  emphasized?: boolean; // draw a ring around this pin (e.g. the driver's next stop)
}

interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: LeafletMarker[];
  polyline?: Array<{ lat: number; lng: number }>;
  draggableMarker?: {
    lat: number | null;
    lng: number | null;
    onChange: (pos: { lat: number; lng: number }) => void;
  };
  fitToMarkers?: boolean;
  heightClassName?: string;
}

const BRAND_GREEN = "#1f4b36";

function pinIcon(L: typeof LType, marker: LeafletMarker): LType.DivIcon {
  const color = marker.color ?? BRAND_GREEN;
  const ring = marker.emphasized ? "box-shadow:0 0 0 3px rgba(31,75,54,0.35);" : "";
  const html = `<div style="
    display:flex;align-items:center;justify-content:center;
    width:26px;height:26px;border-radius:9999px;
    background:${color};color:#fff;font-size:12px;font-weight:600;
    border:2px solid #fff;${ring}
  ">${marker.label ?? ""}</div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/**
 * Key-free interactive map (Leaflet + OpenStreetMap). Renders the map,
 * numbered/coloured pins and route polyline with no API key. Google Maps
 * is used instead when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (see the
 * callers). Tiles require public internet to load; the pins/polyline
 * render regardless.
 */
export function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  polyline,
  draggableMarker,
  fitToMarkers = false,
  heightClassName = "h-64",
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const draggableRef = useRef<LType.Marker | null>(null);
  // Keep the latest onChange without re-initialising the map each render.
  const onChangeRef = useRef(draggableMarker?.onChange);
  useEffect(() => {
    onChangeRef.current = draggableMarker?.onChange;
  });

  // Init once.
  useEffect(() => {
    let cancelled = false;
    let map: LType.Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      if (polyline && polyline.length > 1) {
        L.polyline(
          polyline.map((p) => [p.lat, p.lng] as [number, number]),
          { color: BRAND_GREEN, weight: 3, opacity: 0.6 }
        ).addTo(map);
      }

      const bounds = L.latLngBounds([]);
      for (const m of markers) {
        const mk = L.marker([m.lat, m.lng], { icon: pinIcon(L, m) }).addTo(map);
        if (m.title) mk.bindPopup(m.title);
        bounds.extend([m.lat, m.lng]);
      }

      if (draggableMarker) {
        const start =
          draggableMarker.lat != null && draggableMarker.lng != null
            ? { lat: draggableMarker.lat, lng: draggableMarker.lng }
            : center;
        const dm = L.marker([start.lat, start.lng], {
          draggable: true,
          icon: pinIcon(L, { id: "drag", lat: start.lat, lng: start.lng }),
        }).addTo(map);
        dm.on("dragend", () => {
          const p = dm.getLatLng();
          onChangeRef.current?.({ lat: p.lat, lng: p.lng });
        });
        map.on("click", (e: LType.LeafletMouseEvent) => {
          dm.setLatLng(e.latlng);
          onChangeRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
        draggableRef.current = dm;
      }

      if (fitToMarkers && markers.length > 0) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
      }

      // Tiles can size wrong if the container was hidden at init.
      setTimeout(() => map?.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      draggableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the draggable pin in sync when the parent sets coords elsewhere
  // (e.g. "Resolve Maps link" fills lat/lng in the order form).
  useEffect(() => {
    if (!draggableMarker || !draggableRef.current || !mapRef.current) return;
    if (draggableMarker.lat == null || draggableMarker.lng == null) return;
    const pos: [number, number] = [draggableMarker.lat, draggableMarker.lng];
    draggableRef.current.setLatLng(pos);
    mapRef.current.panTo(pos);
  }, [draggableMarker?.lat, draggableMarker?.lng, draggableMarker]);

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-lg border border-border bg-surface-alt`} />;
}

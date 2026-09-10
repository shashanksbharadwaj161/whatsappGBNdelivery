"use client";

import "leaflet/dist/leaflet.css";
import { createDeliveryPopup, type DeliveryDetails } from "./popup";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, Maximize2, Minimize2, Scan } from "lucide-react";
import type * as LType from "leaflet";

export interface LeafletMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  title?: string;
  emphasized?: boolean;
  details?: DeliveryDetails;
}
interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: LeafletMarker[];
  polyline?: Array<{ lat: number; lng: number }>;
  draggableMarker?: { lat: number | null; lng: number | null; onChange: (pos: { lat: number; lng: number }) => void };
  fitToMarkers?: boolean;
  roadPath?: boolean;
  heightClassName?: string;
  selectedMarkerId?: string;
  onMarkerSelect?: (id: string) => void;
  /** Continuously show the viewer's live GPS position while the map is open. */
  trackLiveLocation?: boolean;
  onLiveLocation?: (pos: { lat: number; lng: number }) => void;
}
const GREEN = "#1f4b36";
function pinIcon(L: typeof LType, marker: LeafletMarker): LType.DivIcon {
  // Use textContent: customer-supplied strings must never become map HTML.
  const pin = document.createElement("div");
  pin.className = `delivery-map-pin${marker.emphasized ? " delivery-map-pin-selected" : ""}`;
  pin.style.backgroundColor = marker.color ?? GREEN;
  pin.textContent = marker.label ?? "•";
  return L.divIcon({ html: pin, className: "delivery-map-marker", iconSize: [44, 44], iconAnchor: [22, 22] });
}

export function LeafletMap({ center, zoom = 13, markers = [], polyline, draggableMarker,
  fitToMarkers = false, roadPath = false, heightClassName = "h-80", selectedMarkerId, onMarkerSelect,
  trackLiveLocation = false, onLiveLocation }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const dragRef = useRef<LType.Marker | null>(null);
  const locationRef = useRef<LType.CircleMarker | null>(null);
  const liveRef = useRef<LType.CircleMarker | null>(null);
  const markerRefs = useRef(new Map<string, LType.Marker>());
  const callbacks = useRef({ onChange: draggableMarker?.onChange, onMarkerSelect, onLiveLocation });
  const initial = useRef({ center, zoom, draggable: Boolean(draggableMarker) });
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { callbacks.current = { onChange: draggableMarker?.onChange, onMarkerSelect, onLiveLocation }; });

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { center: [initial.current.center.lat, initial.current.center.lng], zoom: initial.current.zoom, scrollWheelZoom: false, zoomControl: false, zoomAnimation: false, fadeAnimation: false });
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on("tileerror", () => setNotice("Map tiles could not load. Check your connection; delivery pins are still available.")).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      if (initial.current.draggable) {
        const pos = initial.current.center;
        const marker = L.marker([pos.lat, pos.lng], { draggable: true, icon: pinIcon(L, { id: "pin", ...pos }), title: "Delivery location. Drag to move." }).addTo(map);
        dragRef.current = marker;
        marker.on("dragend", () => { const p = marker.getLatLng(); callbacks.current.onChange?.({ lat: p.lat, lng: p.lng }); });
        map.on("click", (e: LType.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          callbacks.current.onChange?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(containerRef.current);
      setReady(true);
    }).catch(() => setNotice("Could not load the map. Reload the page to try again."));
    return () => { cancelled = true; observer?.disconnect(); mapRef.current?.remove(); mapRef.current = null; dragRef.current = null; layerRef.current = null; };
  }, []);

  // Sync backend refreshes without resetting the map's zoom or position.
  const markerData = JSON.stringify(markers);
  const lineData = JSON.stringify(polyline ?? []);
  useEffect(() => {
    if (!ready) return;
    void import("leaflet").then(({ default: L }) => {
      const map = mapRef.current, layer = layerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();
      markerRefs.current.clear();
      const points: LeafletMarker[] = JSON.parse(markerData);
      for (const point of points) {
        const marker = L.marker([point.lat, point.lng], { icon: pinIcon(L, point), title: point.title ?? `Stop ${point.label}`, keyboard: true }).addTo(layer);
        const popup = createDeliveryPopup(point.title ?? `Stop ${point.label}`, point.details);
        marker.bindPopup(popup).on("click", () => callbacks.current.onMarkerSelect?.(point.id));
        markerRefs.current.set(point.id, marker);
      }
      const path: Array<{ lat: number; lng: number }> = JSON.parse(lineData);
      if (path.length > 1) L.polyline(path.map(p => [p.lat, p.lng]), { color: GREEN, weight: 3, opacity: 0.65, dashArray: roadPath ? undefined : "7 7" }).addTo(layer);
      if (fitToMarkers && !fitted.current && points.length) {
        map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15, animate: false });
        fitted.current = true;
      }
    });
  }, [ready, markerData, lineData, fitToMarkers, roadPath]);

  useEffect(() => {
    if (!ready || !selectedMarkerId) return;
    const marker = markerRefs.current.get(selectedMarkerId);
    if (marker) { mapRef.current?.setView(marker.getLatLng(), 16, { animate: false }); marker.openPopup(); }
  }, [selectedMarkerId, ready]);
  useEffect(() => {
    if (!ready || draggableMarker?.lat == null || draggableMarker.lng == null) return;
    const position: [number, number] = [draggableMarker.lat, draggableMarker.lng];
    dragRef.current?.setLatLng(position);
    mapRef.current?.panTo(position);
  }, [ready, draggableMarker?.lat, draggableMarker?.lng]);
  // Live GPS marker: follow the viewer's position while the map is open,
  // and release the geolocation watch on unmount so it never leaks.
  useEffect(() => {
    if (!ready || !trackLiveLocation) return;
    let cancelled = false;
    let watchId: number | null = null;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled) return;
      if (!navigator.geolocation) { setNotice("Your browser does not support location, so your live position can't be shown."); return; }
      watchId = navigator.geolocation.watchPosition(
        ({ coords }) => {
          const map = mapRef.current;
          if (!map) return;
          const pos: [number, number] = [coords.latitude, coords.longitude];
          if (liveRef.current) liveRef.current.setLatLng(pos);
          else liveRef.current = L.circleMarker(pos, { radius: 8, color: "white", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map).bindPopup("You are here");
          callbacks.current.onLiveLocation?.({ lat: coords.latitude, lng: coords.longitude });
        },
        error => { if (error.code === 1) setNotice("Location access is off. Allow it in your browser settings to see your live position on the map."); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
      );
    });
    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      liveRef.current?.remove();
      liveRef.current = null;
    };
  }, [ready, trackLiveLocation]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [expanded]);

  function fit() {
    const map = mapRef.current;
    const positions = [...markerRefs.current.values()].map(marker => marker.getLatLng());
    if (positions.length) map?.fitBounds(positions.map(p => [p.lat, p.lng] as [number, number]), { padding: [36, 36], maxZoom: 15, animate: false });
    else if (dragRef.current) map?.setView(dragRef.current.getLatLng(), 16);
  }
  function locate() {
    if (!navigator.geolocation) { setNotice("Your browser does not support location. You can still move the map manually."); return; }
    setLocating(true); setNotice(null);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const { default: L } = await import("leaflet");
      const map = mapRef.current;
      if (!map) return;
      const pos: [number, number] = [coords.latitude, coords.longitude];
      locationRef.current?.remove();
      locationRef.current = L.circleMarker(pos, { radius: 8, color: "white", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map).bindPopup("Your location");
      map.setView(pos, 16, { animate: false });
      setLocating(false);
      setNotice(initial.current.draggable ? "Your location is shown in blue. Tap the map to set the delivery pin." : null);
    }, error => { setLocating(false); setNotice(error.code === 1 ? "Location access is off. Allow it in your browser settings, or move the map manually." : "Could not find your location. Try again outdoors or move the map manually."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  return (
    <section aria-label="Interactive delivery map" className={expanded ? "fixed inset-0 z-[100] bg-surface p-3 flex flex-col" : "relative isolate"}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" className="map-tool" onClick={fit} disabled={!ready}><Scan size={17} /> Fit stops</button>
        <button type="button" className="map-tool" onClick={locate} disabled={!ready || locating}><LocateFixed size={17} /> {locating ? "Locating…" : "My location"}</button>
        <button type="button" className="map-tool ml-auto" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Close expanded map" : "Expand map"} aria-pressed={expanded}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
      </div>
      {notice && <p role="status" className="mb-2 rounded-lg bg-accent-soft p-3 text-sm text-ink">{notice}</p>}
      <div className={expanded ? "flex-1 min-h-0" : heightClassName}>
        <div ref={containerRef} className="relative z-0 h-full w-full rounded-xl border border-border bg-surface-alt" aria-label="Pan or zoom the map and select a delivery pin" />
      </div>
      {!ready && !notice && <p role="status" className="absolute inset-x-0 top-1/2 text-center text-sm text-ink-muted">Loading map…</p>}
    </section>
  );
}

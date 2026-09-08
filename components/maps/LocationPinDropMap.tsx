"use client";

import { useEffect, useRef } from "react";
import { useGoogleMapsScript } from "@/lib/maps/useGoogleMapsScript";
import { LeafletMap } from "@/components/maps/LeafletMap";

interface LocationPinDropMapProps {
  latitude: number | null;
  longitude: number | null;
  defaultCenter: { lat: number; lng: number };
  onPinChange: (position: { lat: number; lng: number }) => void;
}

/** Draggable-pin map for manually placing a delivery location. Uses Google
 * Maps when a key is configured, otherwise a key-free Leaflet map. */
export function LocationPinDropMap({ latitude, longitude, defaultCenter, onPinChange }: LocationPinDropMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const { configured, loaded } = useGoogleMapsScript();

  useEffect(() => {
    if (!configured || !loaded || !containerRef.current || mapRef.current) return;

    const center = latitude && longitude ? { lat: latitude, lng: longitude } : defaultCenter;
    const map = new google.maps.Map(containerRef.current, {
      center,
      zoom: 15,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    const marker = new google.maps.Marker({ map, position: center, draggable: true });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) onPinChange({ lat: pos.lat(), lng: pos.lng() });
    });
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      marker.setPosition(e.latLng);
      onPinChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });

    mapRef.current = map;
    markerRef.current = marker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loaded]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || latitude === null || longitude === null) return;
    const pos = { lat: latitude, lng: longitude };
    markerRef.current.setPosition(pos);
    mapRef.current.panTo(pos);
  }, [latitude, longitude]);

  if (configured) {
    return <div ref={containerRef} className="h-48 w-full rounded-lg border border-border" />;
  }

  return (
    <LeafletMap
      center={latitude != null && longitude != null ? { lat: latitude, lng: longitude } : defaultCenter}
      zoom={15}
      draggableMarker={{ lat: latitude, lng: longitude, onChange: onPinChange }}
      heightClassName="h-48"
    />
  );
}

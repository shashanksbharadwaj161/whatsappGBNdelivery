"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { LocationPinDropMap } from "@/components/maps/LocationPinDropMap";
import { updateDefaultStartLocationAction } from "@/lib/actions/settings";

export function DefaultStartLocationForm({
  initial,
}: {
  initial: { label: string; latitude: number; longitude: number };
}) {
  const router = useRouter();
  const [label, setLabel] = useState(initial.label);
  const [latitude, setLatitude] = useState(String(initial.latitude));
  const [longitude, setLongitude] = useState(String(initial.longitude));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateDefaultStartLocationAction({
        label,
        latitude: Number(latitude),
        longitude: Number(longitude),
      });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="startLabel">Label</Label>
        <Input id="startLabel" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <LocationPinDropMap
        latitude={Number(latitude)}
        longitude={Number(longitude)}
        defaultCenter={{ lat: Number(latitude), lng: Number(longitude) }}
        onPinChange={(pos) => {
          setLatitude(String(pos.lat));
          setLongitude(String(pos.lng));
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="startLat">Latitude</Label>
          <Input id="startLat" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="startLng">Longitude</Label>
          <Input id="startLng" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
      </div>

      {saved && <p className="text-sm text-primary">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save default start location"}
      </Button>
    </form>
  );
}

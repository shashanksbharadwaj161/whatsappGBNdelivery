"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Input";
import { useGoogleMapsScript } from "@/lib/maps/useGoogleMapsScript";

interface AddressAutocompleteInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onChange: (value: string) => void;
  onPlaceSelected: (place: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
    placeId?: string;
    area?: string;
  }) => void;
}

function extractArea(components: google.maps.places.PlaceResult["address_components"]): string | undefined {
  if (!components) return undefined;
  const sublocality = components.find((c) => c.types.includes("sublocality") || c.types.includes("sublocality_level_1"));
  if (sublocality) return sublocality.long_name;
  return components.find((c) => c.types.includes("locality"))?.long_name;
}

/** Google Places Autocomplete when a real key is configured; otherwise a plain address input. */
export function AddressAutocompleteInput({ onChange, onPlaceSelected, ...inputProps }: AddressAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { configured, loaded } = useGoogleMapsScript();

  useEffect(() => {
    if (!loaded || !inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" },
      fields: ["formatted_address", "geometry", "place_id", "address_components"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location || !place.formatted_address) return;
      onPlaceSelected({
        formattedAddress: place.formatted_address,
        latitude: location.lat(),
        longitude: location.lng(),
        placeId: place.place_id,
        area: extractArea(place.address_components),
      });
    });

    return () => listener.remove();
  }, [loaded, onPlaceSelected]);

  return (
    <div>
      <Input
        ref={inputRef}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
      {!configured && (
        <p className="mt-1 text-xs text-ink-faint">
          Address autocomplete needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — typing works as normal.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: typeof google;
  }
}

let loadPromise: Promise<void> | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

const PLACEHOLDER_KEYS = new Set(["", "your-google-maps-browser-key", "placeholder"]);

export function isGoogleMapsConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return Boolean(key) && !PLACEHOLDER_KEYS.has(key ?? "");
}

/** Loads the Google Maps JS API once; no-ops (stays false) if no real key is configured. */
export function useGoogleMapsScript() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isGoogleMapsConfigured();

  useEffect(() => {
    if (!configured) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
    loadScript(apiKey)
      .then(() => setLoaded(true))
      .catch((err) => setError(err.message));
  }, [configured]);

  return { configured, loaded, error };
}

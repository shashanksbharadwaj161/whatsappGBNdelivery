"use client";
import { useEffect, useState } from "react";
export function useRoadGeometry(routeId?: string) {
  const [result, setResult] = useState<{ routeId: string; path: Array<{lat: number; lng: number}> }>();
  useEffect(() => {
    if (!routeId) return;
    const controller = new AbortController();
    void fetch(`/api/routes/${encodeURIComponent(routeId)}/geometry`, { signal: controller.signal })
      .then(async response => { if (!response.ok) return; const data = await response.json(); if (!controller.signal.aborted && Array.isArray(data.path)) setResult({ routeId, path: data.path }); })
      .catch(() => { /* Pins remain usable without a road provider. */ });
    return () => controller.abort();
  }, [routeId]);
  return result?.routeId === routeId ? result?.path : undefined;
}

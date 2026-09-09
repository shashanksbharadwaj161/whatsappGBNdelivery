import { test } from "node:test";
import assert from "node:assert/strict";
import { getRoadGeometry } from "../lib/maps/geometry";

test("road preview preserves saved stop order and converts GeoJSON longitude first", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async input => {
    requested = String(input);
    return Response.json({ code: "Ok", routes: [{ geometry: { type: "LineString", coordinates: [[77.5, 13], [77.6, 13.1]] } }] });
  };
  try {
    assert.deepEqual(await getRoadGeometry([{ lat: 13, lng: 77.5 }, { lat: 13.1, lng: 77.6 }]), [{ lat: 13, lng: 77.5 }, { lat: 13.1, lng: 77.6 }]);
    assert.ok(requested.includes("/route/v1/driving/77.5,13;77.6,13.1?"));
  } finally { globalThis.fetch = original; }
});
test("invalid coordinates never reach routing provider", async () => {
  await assert.rejects(getRoadGeometry([{ lat: 91, lng: 0 }, { lat: 0, lng: 0 }]), /invalid coordinates/);
});
test("routing outage and malformed geometry fail honestly", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ code: "NoRoute" });
    await assert.rejects(getRoadGeometry([{ lat: 13, lng: 77 }, { lat: 14, lng: 78 }]), /Road preview is unavailable/);
    globalThis.fetch = async () => { throw new Error("network unavailable"); };
    await assert.rejects(getRoadGeometry([{ lat: 13, lng: 77 }, { lat: 14, lng: 78 }]), /Road preview is unavailable/);
  } finally { globalThis.fetch = original; }
});

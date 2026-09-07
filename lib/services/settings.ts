import { db } from "@/lib/db";

export interface DefaultStartLocation {
  label: string;
  latitude: number;
  longitude: number;
}

const DEFAULT_START_LOCATION_KEY = "default_start_location";

export async function getDefaultStartLocation(): Promise<DefaultStartLocation> {
  const row = await db.setting.findUnique({ where: { key: DEFAULT_START_LOCATION_KEY } });
  if (row) return row.value as unknown as DefaultStartLocation;
  return { label: "Gau Bhoomi Naturals (not configured)", latitude: 13.067, longitude: 77.556 };
}

export async function setDefaultStartLocation(value: DefaultStartLocation) {
  return db.setting.upsert({
    where: { key: DEFAULT_START_LOCATION_KEY },
    update: { value: value as never },
    create: { key: DEFAULT_START_LOCATION_KEY, value: value as never },
  });
}

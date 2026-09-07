import { db } from "@/lib/db";
import type { AddressSource } from "@prisma/client";

export interface CreateAddressInput {
  formattedAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  landmark?: string | null;
  area?: string | null;
  source: AddressSource;
  rawInput?: string | null;
  customerId?: string | null;
}

export async function createAddress(input: CreateAddressInput) {
  return db.address.create({
    data: {
      formattedAddress: input.formattedAddress,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      placeId: input.placeId ?? null,
      landmark: input.landmark ?? null,
      area: input.area ?? null,
      source: input.source,
      rawInput: input.rawInput ?? null,
      customerId: input.customerId ?? null,
    },
  });
}

export function hasCoordinates(address: { latitude: number | null; longitude: number | null }) {
  return address.latitude !== null && address.longitude !== null;
}

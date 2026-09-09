import type { MilkSize } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

export const PRICE_PER_500ML = 65;
export const PRICE_PER_LITRE = 120;
export const DELIVERY_FEE = 5;

/** Unit price for one unit of the given milk size, in rupees. */
export function unitPriceForMilkSize(
  size: MilkSize,
  customQuantityLiters?: number | null
): number {
  if (size === "ML500") return PRICE_PER_500ML;
  if (size === "L1") return PRICE_PER_LITRE;

  if (!customQuantityLiters || customQuantityLiters <= 0) {
    throw new ValidationError("customQuantityLiters is required for CUSTOM milk size");
  }
  return Number((PRICE_PER_LITRE * customQuantityLiters).toFixed(2));
}

export function computeOrderPricing(params: {
  milkSize: MilkSize;
  customQuantityLiters?: number | null;
  quantity: number;
  deliveryFee?: number;
}) {
  if (!Number.isInteger(params.quantity) || params.quantity < 1) throw new ValidationError("Quantity must be a positive whole number");
  const unitPrice = unitPriceForMilkSize(params.milkSize, params.customQuantityLiters);
  const deliveryFee = params.deliveryFee ?? DELIVERY_FEE;
  const subtotal = Number((unitPrice * params.quantity).toFixed(2));
  const total = Number((subtotal + deliveryFee).toFixed(2));
  return { unitPrice, deliveryFee, subtotal, total };
}

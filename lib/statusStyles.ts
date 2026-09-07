import type { OrderStatus, PaymentStatus, RouteStopStatus, ConversationStatus } from "@prisma/client";

type Tone =
  | "neutral"
  | "primary"
  | "accent"
  | "pending"
  | "confirmed"
  | "transit"
  | "delivered"
  | "cancelled"
  | "skipped";

export const ORDER_STATUS_STYLE: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "pending" },
  CONFIRMED: { label: "Confirmed", tone: "confirmed" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "transit" },
  DELIVERED: { label: "Delivered", tone: "delivered" },
  CANCELLED: { label: "Cancelled", tone: "cancelled" },
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Payment pending", tone: "pending" },
  PAID: { label: "Paid", tone: "delivered" },
  CASH: { label: "Cash", tone: "accent" },
  UPI: { label: "UPI", tone: "confirmed" },
};

export const ROUTE_STOP_STATUS_STYLE: Record<RouteStopStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "pending" },
  EN_ROUTE: { label: "En route", tone: "transit" },
  DELIVERED: { label: "Delivered", tone: "delivered" },
  SKIPPED: { label: "Skipped", tone: "skipped" },
  UNAVAILABLE: { label: "Unavailable", tone: "cancelled" },
};

export const CONVERSATION_STATUS_STYLE: Record<ConversationStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "confirmed" },
  LEAD: { label: "Lead", tone: "accent" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export const MILK_SIZE_LABEL: Record<string, string> = {
  ML500: "500 ml",
  L1: "1 Litre",
  CUSTOM: "Custom",
};

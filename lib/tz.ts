import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";

/**
 * All calendar-day logic (delivery dates, "Today"/"Tomorrow", subscription
 * generation) must go through here. The DB stores instants in UTC; this
 * module is the only place that decides what "today" means for the
 * business, which is always Bengaluru local time, never server/UTC time.
 */
export const BUSINESS_TZ = "Asia/Kolkata";

/** "yyyy-MM-dd" for the current instant, evaluated in Asia/Kolkata. */
export function todayBusinessDateString(): string {
  return formatInTimeZone(new Date(), BUSINESS_TZ, "yyyy-MM-dd");
}

export function businessDateStringFrom(date: Date): string {
  return formatInTimeZone(date, BUSINESS_TZ, "yyyy-MM-dd");
}

export function addDaysToBusinessDateString(dateString: string, days: number): string {
  const base = fromZonedTime(`${dateString}T00:00:00`, BUSINESS_TZ);
  const shifted = addDays(base, days);
  return businessDateStringFrom(shifted);
}

/**
 * A "yyyy-MM-dd" calendar date, stored as a Prisma `@db.Date` column, is
 * timezone-naive on the Postgres side — Prisma just needs a Date whose
 * UTC calendar fields match. Midnight UTC is the correct representation
 * regardless of business timezone since no time-of-day is stored.
 */
export function businessDateOnlyToDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export function dateToBusinessDateString(date: Date): string {
  // Must evaluate in the business timezone like every other calendar-day
  // helper here — date-fns `format` would use the host's local zone and
  // drift a day on non-UTC servers.
  return businessDateStringFrom(date);
}

/** UTC instant range covering one full Asia/Kolkata calendar day. */
export function businessDayRangeUtc(dateString: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${dateString}T00:00:00`, BUSINESS_TZ);
  const end = fromZonedTime(`${dateString}T23:59:59.999`, BUSINESS_TZ);
  return { start, end };
}

/** Combine a business calendar date with a local HH:mm time into a UTC instant. */
export function businessDateAndTimeToUtc(dateString: string, hhmm: string): Date {
  return fromZonedTime(`${dateString}T${hhmm}:00`, BUSINESS_TZ);
}

export function formatBusinessTime(date: Date, pattern = "h:mm a"): string {
  return formatInTimeZone(date, BUSINESS_TZ, pattern);
}

export function formatBusinessDateTime(date: Date, pattern = "d MMM, h:mm a"): string {
  return formatInTimeZone(date, BUSINESS_TZ, pattern);
}

export function toBusinessZoned(date: Date): Date {
  return toZonedTime(date, BUSINESS_TZ);
}

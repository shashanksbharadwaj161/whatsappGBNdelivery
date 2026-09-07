import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

import { PrismaClient, type MilkSize } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeOrderPricing } from "../lib/pricing";
import { todayBusinessDateString, businessDateOnlyToDate } from "../lib/tz";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Placeholder ids until a real Supabase project exists — override via env
// once real auth.users ids are known, then re-run this script.
const OWNER_USER_ID = process.env.SEED_OWNER_USER_ID ?? "00000000-0000-0000-0000-000000000001";
const DRIVER_USER_ID = process.env.SEED_DRIVER_USER_ID ?? "00000000-0000-0000-0000-000000000002";

// Real north-Bengaluru localities the business actually delivers to
// (approximate but genuinely distinct coordinates, per locality) — used
// to sanity-check that route optimization produces a sensible ordering,
// e.g. Abbigere -> Chikkabanavara -> Mathikere rather than a random walk.
const CUSTOMERS: Array<{
  name: string;
  phone: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  milkSize: MilkSize;
}> = [
  { name: "Ramesh Kumar", phone: "+919845010001", area: "Abbigere", address: "12th Cross, Abbigere, Bengaluru 560090", lat: 13.0678, lng: 77.5157, milkSize: "L1" },
  { name: "Suresh Gowda", phone: "+919845010002", area: "Chikkabanavara", address: "Chikkabanavara Main Road, Bengaluru 560090", lat: 13.0784, lng: 77.5031, milkSize: "ML500" },
  { name: "Anita Rao", phone: "+919845010003", area: "Mathikere", address: "3rd Main, Mathikere, Bengaluru 560054", lat: 13.0349, lng: 77.5535, milkSize: "L1" },
  { name: "Deepa Nair", phone: "+919845010004", area: "Yelahanka", address: "Yelahanka New Town, Bengaluru 560064", lat: 13.1007, lng: 77.5963, milkSize: "L1" },
  { name: "Manjunath R", phone: "+919845010005", area: "Jakkur", address: "Jakkur Main Road, Bengaluru 560064", lat: 13.0779, lng: 77.5966, milkSize: "ML500" },
  { name: "Kavya S", phone: "+919845010006", area: "Hebbal", address: "Hebbal Ring Road, Bengaluru 560024", lat: 13.0358, lng: 77.5970, milkSize: "L1" },
  { name: "Prakash Bhat", phone: "+919845010007", area: "Jalahalli", address: "Jalahalli Cross, Bengaluru 560013", lat: 13.0470, lng: 77.5470, milkSize: "ML500" },
  { name: "Lakshmi Iyer", phone: "+919845010008", area: "Vidyaranyapura", address: "Vidyaranyapura Main Road, Bengaluru 560097", lat: 13.0672, lng: 77.5563, milkSize: "L1" },
];

async function main() {
  console.log("Seeding Gau Bhoomi Naturals dev data...");

  await db.profile.upsert({
    where: { id: OWNER_USER_ID },
    update: {},
    create: { id: OWNER_USER_ID, fullName: "Gau Bhoomi Owner", role: "OWNER" },
  });
  await db.profile.upsert({
    where: { id: DRIVER_USER_ID },
    update: {},
    create: { id: DRIVER_USER_ID, fullName: "Delivery Driver", role: "DRIVER" },
  });

  // Default delivery start location — placeholder until the real
  // farm/store location is supplied and set via Settings.
  await db.setting.upsert({
    where: { key: "default_start_location" },
    update: {},
    create: {
      key: "default_start_location",
      value: {
        label: "Gau Bhoomi Naturals (placeholder — set the real base in Settings)",
        latitude: 13.067,
        longitude: 77.556,
      },
    },
  });

  const today = todayBusinessDateString();

  for (const [index, c] of CUSTOMERS.entries()) {
    const customer = await db.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: { name: c.name, phone: c.phone },
    });

    const address = await db.address.create({
      data: {
        formattedAddress: c.address,
        latitude: c.lat,
        longitude: c.lng,
        area: c.area,
        source: "MANUAL_PIN",
        rawInput: "seed data",
        customerId: customer.id,
      },
    });

    if (!customer.defaultAddressId) {
      await db.customer.update({ where: { id: customer.id }, data: { defaultAddressId: address.id } });
    }

    const pricing = computeOrderPricing({ milkSize: c.milkSize, quantity: 1 });

    // First two customers stay PENDING so the "Create Order -> Confirm"
    // flow has something to demonstrate; the rest are pre-CONFIRMED so
    // route optimization has real, ready-to-route orders immediately.
    const status = index < 2 ? "PENDING" : "CONFIRMED";

    await db.order.create({
      data: {
        customerId: customer.id,
        addressId: address.id,
        milkSize: c.milkSize,
        quantity: 1,
        orderType: "ONE_TIME",
        source: "MANUAL",
        deliveryDate: businessDateOnlyToDate(today),
        deliveryWindow: "MORNING",
        unitPrice: pricing.unitPrice,
        deliveryFee: pricing.deliveryFee,
        subtotal: pricing.subtotal,
        total: pricing.total,
        paymentStatus: "PENDING",
        status,
        createdByUserId: OWNER_USER_ID,
      },
    });
  }

  // One active daily subscription, on the last seeded customer.
  const subCustomer = await db.customer.findUnique({ where: { phone: CUSTOMERS[7].phone } });
  if (subCustomer?.defaultAddressId) {
    await db.subscription.create({
      data: {
        customerId: subCustomer.id,
        addressId: subCustomer.defaultAddressId,
        milkSize: "L1",
        quantity: 1,
        frequency: "DAILY",
        startDate: businessDateOnlyToDate(today),
        status: "ACTIVE",
        deliveryWindow: "MORNING",
      },
    });
  }

  // Sample WhatsApp conversations/messages so the Inbox (Phase 2) has
  // something real to show, including a location-pin message.
  const leadConvo = await db.whatsappConversation.upsert({
    where: { waId: "919845099001" },
    update: {},
    create: {
      waId: "919845099001",
      displayName: "New WhatsApp Lead",
      status: "OPEN",
      lastMessageAt: new Date(),
      unreadCount: 2,
    },
  });
  await db.whatsappMessage.createMany({
    data: [
      {
        conversationId: leadConvo.id,
        direction: "INBOUND",
        type: "TEXT",
        textBody: "Hi, I want 1 litre A2 milk daily. My address is near Jalahalli cross.",
      },
      {
        conversationId: leadConvo.id,
        direction: "INBOUND",
        type: "LOCATION",
        locationLatitude: 13.047,
        locationLongitude: 77.547,
        locationName: "Jalahalli Cross",
      },
    ],
  });

  const existingCustomerConvo = await db.whatsappConversation.upsert({
    where: { waId: CUSTOMERS[0].phone.replace("+", "") },
    update: {},
    create: {
      waId: CUSTOMERS[0].phone.replace("+", ""),
      customerId: (await db.customer.findUnique({ where: { phone: CUSTOMERS[0].phone } }))!.id,
      displayName: CUSTOMERS[0].name,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });
  await db.whatsappMessage.create({
    data: {
      conversationId: existingCustomerConvo.id,
      direction: "INBOUND",
      type: "TEXT",
      textBody: "Please deliver 1 extra litre tomorrow, we have guests.",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

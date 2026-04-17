import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { User } from "../models/User.js";
import { RiderProfile } from "../models/RiderProfile.js";

async function seed() {
  await connectDatabase();
  await Promise.all([User.deleteMany({}), RiderProfile.deleteMany({})]);

  const rider = await User.create({
    name: "Eshwar",
    email: "eshwar@example.com",
    phone: "+919999999999",
    role: "RIDER",
    aadhaarVerified: true,
    status: "ACTIVE"
  });

  await RiderProfile.create({
    userId: rider._id,
    provider: "ZOMATO",
    partnerId: "ZOM2300033202",
    aadhaarLast4: "1181",
    city: "Hyderabad",
    zoneCode: "500001",
    registeredZonePolygon: [
      { lat: 17.49, lng: 78.39 },
      { lat: 17.5, lng: 78.41 }
    ],
    currentGps: { lat: 17.4948, lng: 78.3996 },
    deviceFingerprint: "device-eshwar-01",
    upiId: "eshwar@upi",
    plan: "PRO",
    weeklyEarningsAverage: 3500,
    activeDelivery: {
      orderId: "ORD-101",
      acceptedAt: new Date(Date.now() - 20 * 60 * 1000),
      pickupAt: new Date(Date.now() - 10 * 60 * 1000),
      estimatedDropAt: new Date(Date.now() + 25 * 60 * 1000),
      status: "PICKED_UP"
    },
    motionTelemetry: {
      accelerometerScore: 0.72,
      gyroscopeScore: 0.69,
      averageSpeedKph: 22
    },
    earningsHistory: [
      {
        slotStart: new Date("2026-03-03T14:00:00Z"),
        slotEnd: new Date("2026-03-03T18:00:00Z"),
        earnings: 580,
        orders: 10
      },
      {
        slotStart: new Date("2026-03-10T14:00:00Z"),
        slotEnd: new Date("2026-03-10T18:00:00Z"),
        earnings: 620,
        orders: 11
      }
    ]
  });

  console.log("Seed complete");
  await mongoose.connection.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

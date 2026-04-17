import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { User } from "../models/User.js";
import { RiderProfile } from "../models/RiderProfile.js";
import { Claim } from "../models/Claim.js";
import { Payout } from "../models/Payout.js";
import { Appeal } from "../models/Appeal.js";
import { Complaint } from "../models/Complaint.js";
import { Policy } from "../models/Policy.js";
import { PremiumPayment } from "../models/PremiumPayment.js";
import { Event } from "../models/Event.js";
import { FraudLog } from "../models/FraudLog.js";
import { ROLES } from "../constants/roles.js";

async function resetRiders() {
  await connectDatabase();

  const riderUsers = await User.find({ role: ROLES.RIDER }).select("_id").lean();
  const riderIds = riderUsers.map((user) => user._id);

  await Promise.all([
    RiderProfile.deleteMany({ userId: { $in: riderIds } }),
    Claim.deleteMany({ riderId: { $in: riderIds } }),
    Payout.deleteMany({ riderId: { $in: riderIds } }),
    Appeal.deleteMany({ riderId: { $in: riderIds } }),
    Complaint.deleteMany({ riderId: { $in: riderIds } }),
    Policy.deleteMany({ riderId: { $in: riderIds } }),
    PremiumPayment.deleteMany({ riderId: { $in: riderIds } }),
    User.deleteMany({ _id: { $in: riderIds } })
  ]);

  await Event.deleteMany({});
  await FraudLog.deleteMany({});

  console.log("All rider data deleted along with events and fraud logs.");
  await mongoose.connection.close();
}

resetRiders().catch((error) => {
  console.error(error);
  process.exit(1);
});

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/db.js";
import { User } from "../models/User.js";

async function createAdmin() {
  await connectDatabase();

  const email = process.argv[2];
  const phone = process.argv[3] || "";
  const name = process.argv[4] || "WEMA Admin";
  const password = process.argv[5];

  if (!email || !password) {
    throw new Error("Usage: npm run seed:admin -- <email> [phone] [name] <password>");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = "ADMIN";
    existing.status = "ACTIVE";
    existing.aadhaarVerified = true;
    existing.phone = phone || existing.phone;
    existing.name = name || existing.name;
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Updated existing admin: ${existing.email}`);
  } else {
    await User.create({
      firebaseUid: email,
      name,
      email,
      phone,
      passwordHash,
      role: "ADMIN",
      aadhaarVerified: true,
      status: "ACTIVE"
    });
    console.log(`Created admin: ${email}`);
  }

  await mongoose.connection.close();
}

createAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});

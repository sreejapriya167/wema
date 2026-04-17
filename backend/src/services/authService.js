import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { RiderProfile } from "../models/RiderProfile.js";
import { ROLES } from "../constants/roles.js";
import { ApiError } from "../utils/ApiError.js";
import { buildCirclePolygon } from "../utils/geo.js";
import { cityFromPin, isValidPin, normalizePin } from "../utils/pincode.js";
import { normalizeCity } from "../utils/geography.js";

const cityDefaults = {
  Hyderabad: { lat: 17.4948, lng: 78.3996 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Kavali: { lat: 14.913, lng: 79.995 },
  Vijayawada: { lat: 16.5062, lng: 80.6480 },
  Visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  Guntur: { lat: 16.3067, lng: 80.4365 },
  Tirupati: { lat: 13.6288, lng: 79.4192 },
  Nellore: { lat: 14.4426, lng: 79.9865 }
};

function buildDefaultEarningsHistory(referenceDate = new Date()) {
  const history = [];
  for (let week = 1; week <= 4; week += 1) {
    const slotStart = new Date(referenceDate);
    slotStart.setDate(slotStart.getDate() - week * 7);
    slotStart.setHours(14, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(18, 0, 0, 0);

    history.push({
      slotStart,
      slotEnd,
      orders: 8 + week,
      earnings: 480 + week * 35
    });
  }
  return history;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function normalizePlatform(platform) {
  const normalized = String(platform || "").trim().toUpperCase();
  if (!["ZOMATO", "SWIGGY"].includes(normalized)) {
    throw new ApiError(400, "Platform must be Zomato or Swiggy");
  }
  return normalized;
}

function normalizePhone(phone) {
  const normalized = String(phone || "").trim();
  if (!normalized) {
    throw new ApiError(400, "Phone number is required");
  }
  return normalized;
}

function normalizePartnerId(partnerId, platform) {
  const normalized = String(partnerId || "").trim().toUpperCase();
  if (!normalized) {
    throw new ApiError(400, "Delivery Partner ID is required");
  }

  const expectedPrefix = platform === "ZOMATO" ? "ZOM" : "SWG";
  if (!normalized.startsWith(expectedPrefix)) {
    throw new ApiError(400, `Delivery Partner ID must start with ${expectedPrefix} for ${platform}`);
  }

  return normalized;
}

function normalizeAadhaarLast4(aadhaarLast4) {
  const normalized = String(aadhaarLast4 || "").replace(/\D/g, "");
  if (!/^\d{4}$/.test(normalized)) {
    throw new ApiError(400, "Aadhaar last 4 must be exactly 4 digits");
  }
  return normalized;
}

function normalizeRequiredText(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new ApiError(400, `${fieldName} is required`);
  }
  return normalized;
}

function normalizePassword(password, fieldName = "Password") {
  const normalized = String(password || "");
  if (!normalized.trim()) {
    throw new ApiError(400, `${fieldName} is required`);
  }
  if (normalized.length < 6) {
    throw new ApiError(400, `${fieldName} must be at least 6 characters`);
  }
  return normalized;
}

async function buildSessionForUser(user) {
  const riderProfile = user.role === ROLES.RIDER ? await RiderProfile.findOne({ userId: user._id }).lean() : null;
  return {
    user,
    riderProfile,
    token: signToken(user)
  };
}

async function ensureLegacyPartnerIdentity(riderProfile, submittedPartnerId = "") {
  if (!riderProfile) {
    return riderProfile;
  }

  let changed = false;
  const provider = normalizePlatform(riderProfile.provider || "ZOMATO");

  if (!riderProfile.partnerId) {
    const fallbackPartnerId = submittedPartnerId
      ? normalizePartnerId(submittedPartnerId, provider)
      : `${provider === "SWIGGY" ? "SWG" : "ZOM"}${String(riderProfile.userId || riderProfile._id).slice(-6).toUpperCase()}`;
    riderProfile.partnerId = fallbackPartnerId;
    changed = true;
  }

  if (!riderProfile.aadhaarLast4) {
    riderProfile.aadhaarLast4 = "1234";
    changed = true;
  }

  if (changed) {
    await riderProfile.save();
  }

  return riderProfile;
}

export async function loginWithFirebase(_idToken, profile = {}) {
  if (!profile.email && !profile.phone) {
    throw new ApiError(400, "Email or phone is required");
  }

  const requestedRole = profile.role || ROLES.RIDER;
  const lookupConditions = [
    ...(profile.email ? [{ email: profile.email }] : []),
    ...(profile.phone ? [{ phone: profile.phone }] : [])
  ];

  let user = lookupConditions.length ? await User.findOne({ $or: lookupConditions }) : null;

  if (!user) {
    if (requestedRole === ROLES.ADMIN) {
      throw new ApiError(403, "Admin accounts are created manually only");
    }

    const localIdentity = {
      uid: profile.email || profile.phone || `local-${Date.now()}`,
      email: profile.email,
      phone_number: profile.phone,
      name: profile.name || "New Rider"
    };

    user = await User.create({
      firebaseUid: localIdentity.uid,
      name: localIdentity.name,
      email: localIdentity.email,
      phone: localIdentity.phone_number,
      role: requestedRole,
      aadhaarVerified: Boolean(profile.aadhaarVerified),
      status: profile.aadhaarVerified ? "ACTIVE" : "PENDING_VERIFICATION"
    });
  } else {
    if (requestedRole === ROLES.ADMIN && user.role !== ROLES.ADMIN) {
      throw new ApiError(403, "This account does not have admin access");
    }

    if (requestedRole === ROLES.RIDER && user.role !== ROLES.RIDER) {
      throw new ApiError(403, "Use admin login for this account");
    }

    if (!user.firebaseUid) {
      user.firebaseUid = profile.email || profile.phone || `local-${user._id.toString()}`;
    }

    if (requestedRole === ROLES.ADMIN) {
      if (!profile.password) {
        throw new ApiError(400, "Admin password is required");
      }

      if (!user.passwordHash) {
        throw new ApiError(403, "Admin account is not password-enabled yet");
      }

      const passwordValid = await bcrypt.compare(profile.password, user.passwordHash);
      if (!passwordValid) {
        throw new ApiError(401, "Invalid admin credentials");
      }
    }

    user.name = profile.name || user.name;
    user.email = profile.email || user.email;
    user.phone = profile.phone || user.phone;
    if (typeof profile.aadhaarVerified === "boolean") {
      user.aadhaarVerified = profile.aadhaarVerified;
      user.status = profile.aadhaarVerified ? "ACTIVE" : user.status;
    }
    await user.save();
  }

  if (user.role === ROLES.RIDER) {
    const existingProfile = await RiderProfile.findOne({ userId: user._id });
    if (!existingProfile) {
      const normalizedPin = normalizePin(profile.zoneCode);
      const validPin = normalizedPin && isValidPin(normalizedPin);
      const derivedCity = validPin ? cityFromPin(normalizedPin) : null;
      const finalCity = normalizeCity(profile.city || derivedCity || "Hyderabad");
      const baseGps = profile.currentGps || cityDefaults[finalCity] || cityDefaults.Hyderabad;
      const zonePolygon = profile.registeredZonePolygon?.length
        ? profile.registeredZonePolygon
        : buildCirclePolygon(baseGps, 5);
      const provider = normalizePlatform(profile.provider || "ZOMATO");
      const partnerPrefix = provider === "SWIGGY" ? "SWG" : "ZOM";

      await RiderProfile.create({
        userId: user._id,
        provider,
        partnerId: profile.partnerId || `${partnerPrefix}${String(user._id).slice(-6).toUpperCase()}`,
        aadhaarLast4: normalizeAadhaarLast4(profile.aadhaarLast4 || profile.aadhaarNumber || "1234"),
        city: finalCity,
        zoneCode: validPin ? normalizedPin : "500001",
        registeredZonePolygon: zonePolygon,
        currentGps: baseGps,
        deviceFingerprint: profile.deviceFingerprint || "demo-device",
        upiId: profile.upiId || "demo@upi",
        weeklyEarningsAverage: profile.weeklyEarningsAverage || 3500,
        earningsHistory: profile.earningsHistory?.length ? profile.earningsHistory : buildDefaultEarningsHistory()
      });
    }
  }

  return {
    user,
    token: signToken(user)
  };
}

export async function registerRider(payload = {}) {
  const name = normalizeRequiredText(payload.name, "Name");
  const phone = normalizePhone(payload.phone);
  const password = normalizePassword(payload.password, "Password");
  const email = payload.email ? String(payload.email).trim().toLowerCase() : undefined;
  const platform = normalizePlatform(payload.platform || payload.provider);
  const partnerId = normalizePartnerId(payload.partnerId, platform);
  const aadhaarLast4 = normalizeAadhaarLast4(payload.aadhaarLast4 || payload.aadhaarNumber);
  const city = normalizeCity(normalizeRequiredText(payload.city, "City"));
  const zoneCode = normalizePin(payload.zoneCode);
  const upiId = normalizeRequiredText(payload.upiId, "UPI ID");

  if (!zoneCode || !isValidPin(zoneCode)) {
    throw new ApiError(400, "Zone code must be a valid 6-digit PIN");
  }

  const existingUser = await User.findOne({
    $or: [{ phone }, ...(email ? [{ email }] : [])]
  });
  if (existingUser) {
    if (existingUser.phone === phone) {
      throw new ApiError(409, "Phone number is already registered");
    }
    throw new ApiError(409, "Email is already registered");
  }

  const existingPartner = await RiderProfile.findOne({ partnerId });
  if (existingPartner) {
    throw new ApiError(409, "Delivery Partner ID is already registered");
  }

  const baseGps = payload.currentGps || cityDefaults[city] || cityDefaults[cityFromPin(zoneCode)] || cityDefaults.Hyderabad;
  const zonePolygon = payload.registeredZonePolygon?.length ? payload.registeredZonePolygon : buildCirclePolygon(baseGps, 5);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    firebaseUid: `local-${phone}`,
    name,
    email,
    phone,
    passwordHash,
    role: ROLES.RIDER,
    aadhaarVerified: true,
    status: "ACTIVE"
  });

  await RiderProfile.create({
    userId: user._id,
    provider: platform,
    partnerId,
    aadhaarLast4,
    city,
    zoneCode,
    registeredZonePolygon: zonePolygon,
    currentGps: baseGps,
    deviceFingerprint: payload.deviceFingerprint || `${platform.toLowerCase()}-${phone}`,
    upiId,
    weeklyEarningsAverage: payload.weeklyEarningsAverage || 3500,
    earningsHistory: payload.earningsHistory?.length ? payload.earningsHistory : buildDefaultEarningsHistory()
  });

  return buildSessionForUser(user);
}

export async function loginRider(payload = {}) {
  const phone = normalizePhone(payload.phone);
  const password = normalizePassword(payload.password, "Password");

  const user = await User.findOne({ phone, role: ROLES.RIDER });
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.passwordHash) {
    throw new ApiError(401, "Password is not set for this account. Please register again or contact support.");
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const existingProfile = await RiderProfile.findOne({ userId: user._id });
  const riderProfile = await ensureLegacyPartnerIdentity(existingProfile);
  if (!riderProfile) {
    throw new ApiError(401, "Invalid credentials");
  }

  return {
    user,
    riderProfile: riderProfile.toObject(),
    token: signToken(user)
  };
}

export async function getProfile(userId) {
  const user = await User.findById(userId).lean();
  let riderProfile = null;
  if (user?.role === ROLES.RIDER) {
    const profileDoc = await RiderProfile.findOne({ userId });
    if (profileDoc) {
      await ensureLegacyPartnerIdentity(profileDoc);
      riderProfile = profileDoc.toObject();
    }
  }
  return { user, riderProfile };
}

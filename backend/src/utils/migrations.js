import { User } from "../models/User.js";

export async function normalizeUserNotificationChannels() {
  await User.updateMany(
    {
      $or: [
        { "preferences.notificationChannels": { $exists: false } },
        { "preferences.notificationChannels.email": { $exists: false } },
        { "preferences.notificationChannels.sms": { $exists: false } }
      ]
    },
    {
      $set: {
        "preferences.notificationChannels.email": true,
        "preferences.notificationChannels.sms": false
      }
    }
  );
}

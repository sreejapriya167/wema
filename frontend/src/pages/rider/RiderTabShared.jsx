export const TAB_ITEMS = [
  { key: "home", label: "Home" },
  { key: "policy", label: "Policy" },
  { key: "claims", label: "Claims" },
  { key: "payouts", label: "Payouts" },
  { key: "profile", label: "Profile" }
];

export const PLAN_LOCK_MONTHS = {
  BASIC: 2,
  STANDARD: 6,
  PRO: 9,
  PREMIUM: 12
};

export const PLAN_ORDER = ["BASIC", "STANDARD", "PRO", "PREMIUM"];

export function statusTone(value) {
  const normalized = String(value || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "PAID", "SUCCESS", "RESOLVED", "YES"].includes(normalized)) return "ui-status-active";
  if (["PENDING", "HOLD_RIDER_VERIFICATION", "PROCESSING", "UNDER_REVIEW"].includes(normalized)) return "ui-status-pending";
  if (["REJECTED", "FAILED", "ERROR"].includes(normalized)) return "ui-status-error";
  if (["INACTIVE", "NO", "NO_EVENT", "IDLE"].includes(normalized)) return "ui-subtext";
  return "ui-important";
}

export function formatCurrency(value = 0) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatPremiumDueDate(value) {
  const target = value ? new Date(value) : (() => {
    const next = new Date();
    const day = next.getDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    next.setDate(next.getDate() + daysUntilMonday);
    return next;
  })();

  return target.toLocaleDateString("en-IN", { weekday: "long" });
}

export function readIdentityMeta(rider) {
  return {
    platform: rider?.provider || "",
    partnerId: rider?.partnerId || "",
    aadhaarLast4: rider?.aadhaarLast4 || ""
  };
}

export function EmptyState({ children }) {
  return <div className="ui-card-block ui-subtext rounded-xl px-4 py-4 text-sm">{children}</div>;
}

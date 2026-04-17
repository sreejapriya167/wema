
import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";

const SECTION_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "payouts", label: "Payouts" },
  { key: "triggers", label: "Triggers" },
  { key: "support", label: "Support" },
  { key: "fraud", label: "Fraud" },
  { key: "riders", label: "Riders" },
  { key: "pool", label: "Pool Health" },
  { key: "shifts", label: "Shifts" },
  { key: "logs", label: "Alert Log" },
  { key: "settings", label: "Settings" }
];

const EVENT_OPTIONS = [
  "HEAVY_RAIN",
  "FLOOD",
  "CYCLONE",
  "EARTHQUAKE",
  "EXTREME_HEAT",
  "SEVERE_POLLUTION",
  "BANDH",
  "CURFEW",
  "STRIKE",
  "ZONE_CLOSURE"
];

const STATUS_OPTIONS = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "APPROVED",
  "ADMIN_REVIEW",
  "REJECTED",
  "HOLD_RIDER_VERIFICATION"
];

function formatCurrency(value = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function Tag({ children, color = "var(--admin-accent)", soft = "var(--admin-accent-soft)" }) {
  return (
    <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: soft, color }}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, note, accent }) {
  return (
    <div className="admin-panel rounded-[24px] p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.24em] admin-subtle">{label}</p>
      <p className="mt-4 text-4xl font-semibold" style={{ color: accent || "var(--admin-text)" }}>
        {value}
      </p>
      <p className="mt-2 text-sm admin-subtle">{note}</p>
    </div>
  );
}

function AdminSection({ title, subtitle, actions, children }) {
  return (
    <section className="admin-panel rounded-[28px] p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm admin-subtle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MapGrid({ triggers }) {
  return (
    <div className="rounded-[24px] border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
      <div className="grid gap-3 md:grid-cols-2">
        {triggers.map((trigger) => (
          <div key={trigger._id} className="rounded-2xl p-4" style={{ background: "var(--admin-surface)" }}>
            <Tag color={trigger.color} soft={`${trigger.color}22`}>{trigger.label}</Tag>
            <p className="mt-2 font-semibold">{trigger.city} - {trigger.zoneCode}</p>
            <p className="mt-1 text-sm admin-subtle">{trigger.eligibleRiders} eligible riders</p>
          </div>
        ))}
        {!triggers.length ? <p className="text-sm admin-subtle">No active triggers.</p> : null}
      </div>
    </div>
  );
}

function ExportButton({ rows, filename, label }) {
  const handleExport = () => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      className="rounded-2xl px-4 py-3 text-sm font-semibold"
      style={{ background: "var(--admin-accent)", color: "#fff" }}
      type="button"
      onClick={handleExport}
    >
      {label}
    </button>
  );
}
export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedState, setSelectedState] = useState("");
  const [theme, setTheme] = useState("dark");
  const [selectedRider, setSelectedRider] = useState(null);
  const [queueFilters, setQueueFilters] = useState({ zone: "ALL", type: "ALL", status: "ALL", search: "" });
  const [riderFilters, setRiderFilters] = useState({ search: "", zone: "ALL", plan: "ALL", kyc: "ALL" });
  const [logFilter, setLogFilter] = useState({ source: "ALL", search: "" });
  const [eventForm, setEventForm] = useState({
    sourceType: "WEATHER",
    eventType: "HEAVY_RAIN",
    city: "",
    zoneCode: "",
    centerLat: "",
    centerLng: "",
    radiusKm: "5",
    severityLabel: "MODERATE",
    severityFactor: "1",
    lossHours: "2"
  });
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [complaintReviewDrafts, setComplaintReviewDrafts] = useState({});

  const loadDashboard = async (requestedState = selectedState) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/dashboard", {
        params: requestedState ? { state: requestedState } : {}
      });
      setDashboard(data.data);
      setSelectedState(data.data.adminScope?.selectedState || "");
      setTheme(data.data.adminScope?.theme || "dark");
      setSettingsDraft({
        state: data.data.adminScope?.selectedState,
        triggerThresholds: { ...data.data.settings?.triggerThresholds },
        payoutCaps: { ...data.data.settings?.payoutCaps },
        notificationPreferences: { ...data.data.settings?.notificationPreferences },
        reserveBufferTarget: data.data.settings?.reserveBufferTarget,
        safePoolThreshold: data.data.settings?.safePoolThreshold,
        autoApproveLowRisk: data.data.settings?.autoApproveLowRisk
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load admin portal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    document.body.dataset.adminTheme = theme;
    return () => {
      delete document.body.dataset.adminTheme;
    };
  }, [theme]);

  const availableZones = useMemo(
    () => [...new Set((dashboard?.riderManagement || []).map((rider) => rider.zone))].sort(),
    [dashboard]
  );
  const availablePlans = useMemo(
    () => [...new Set((dashboard?.riderManagement || []).map((rider) => rider.plan))].sort(),
    [dashboard]
  );

  const filteredQueue = useMemo(() => {
    const search = queueFilters.search.trim().toLowerCase();
    return (dashboard?.payoutQueue || []).filter((item) => {
      const matchesZone = queueFilters.zone === "ALL" || item.zone === queueFilters.zone;
      const matchesType = queueFilters.type === "ALL" || item.calamityType === queueFilters.type;
      const matchesStatus =
        queueFilters.status === "ALL" || item.transferStatus === queueFilters.status || item.decision === queueFilters.status;
      const matchesSearch = !search || `${item.riderName} ${item.zone}`.toLowerCase().includes(search);
      return matchesZone && matchesType && matchesStatus && matchesSearch;
    });
  }, [dashboard, queueFilters]);

  const filteredRiders = useMemo(() => {
    const search = riderFilters.search.trim().toLowerCase();
    return (dashboard?.riderManagement || []).filter((item) => {
      const matchesSearch = !search || `${item.name} ${item.riderIdLabel}`.toLowerCase().includes(search);
      const matchesZone = riderFilters.zone === "ALL" || item.zone === riderFilters.zone;
      const matchesPlan = riderFilters.plan === "ALL" || item.plan === riderFilters.plan;
      const matchesKyc = riderFilters.kyc === "ALL" || item.kycStatus === riderFilters.kyc;
      return matchesSearch && matchesZone && matchesPlan && matchesKyc;
    });
  }, [dashboard, riderFilters]);

  const filteredLogs = useMemo(() => {
    const search = logFilter.search.trim().toLowerCase();
    return (dashboard?.alertLog || []).filter((item) => {
      const matchesSource = logFilter.source === "ALL" || item.source === logFilter.source;
      const matchesSearch = !search || `${item.dataType} ${item.region}`.toLowerCase().includes(search);
      return matchesSource && matchesSearch;
    });
  }, [dashboard, logFilter]);

  const changeTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      await api.patch("/admin/preferences", { theme: nextTheme });
      setMessage(`Theme saved as ${nextTheme}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to save theme preference.");
    }
  };

  const changeState = async (event) => {
    const nextState = event.target.value;
    setSelectedState(nextState);
    try {
      await api.patch("/admin/preferences", { selectedState: nextState });
      await loadDashboard(nextState);
      setMessage(`Scope switched to ${nextState}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update admin state.");
    }
  };

  const runWeatherSync = async () => {
    try {
      setError("");
      await api.post("/admin/weather-sync");
      setMessage("Weather sync completed and new triggers were evaluated.");
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to run weather sync.");
    }
  };

  const runDemoSeed = async () => {
    try {
      setError("");
      await api.post("/admin/demo/seed", { state: selectedState });
      setMessage("Demo data generated across selected scope.");
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to seed demo data.");
    }
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    const now = new Date();
    const lossWindowEnd = new Date(now);
    lossWindowEnd.setHours(lossWindowEnd.getHours() + Number(eventForm.lossHours || 2));

    try {
      setError("");
      await api.post("/admin/events", {
        sourceType: eventForm.sourceType,
        eventType: eventForm.eventType,
        city: eventForm.city,
        zoneCode: eventForm.zoneCode,
        center: {
          lat: Number(eventForm.centerLat),
          lng: Number(eventForm.centerLng)
        },
        radiusKm: Number(eventForm.radiusKm),
        affectedPolygon: [{ lat: Number(eventForm.centerLat), lng: Number(eventForm.centerLng) }],
        severity: {
          label: eventForm.severityLabel,
          factor: Number(eventForm.severityFactor)
        },
        thresholdSnapshot: { manuallyCreated: true, state: selectedState },
        lossWindowStart: now,
        lossWindowEnd
      });
      setMessage("Trigger created successfully.");
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to create trigger.");
    }
  };

  const processEvent = async (eventId) => {
    try {
      setError("");
      await api.post(`/admin/events/${eventId}/process`);
      setMessage("Trigger processed and riders evaluated.");
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to process trigger.");
    }
  };

  const decideSocialTrigger = async (eventId, approved) => {
    try {
      setError("");
      await api.patch(`/admin/social-triggers/${eventId}/decision`, {
        approved,
        note: approved ? "Confirmed from admin trigger desk" : "Dismissed from admin trigger desk"
      });
      setMessage(`Social trigger ${approved ? "confirmed" : "dismissed"}.`);
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to review social trigger.");
    }
  };

  const reviewClaim = async (claimId, approved) => {
    try {
      setError("");
      await api.patch(`/admin/claims/${claimId}/review`, {
        approved,
        note: approved ? "Approved from admin payout queue" : "Rejected from admin payout queue"
      });
      setMessage(`Claim ${approved ? "approved" : "rejected"}.`);
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to review claim.");
    }
  };

  const reviewAppeal = async (appealId, approved) => {
    try {
      setError("");
      await api.patch(`/admin/appeals/${appealId}/review`, {
        approved,
        note: approved ? "Appeal accepted after manual review" : "Appeal rejected after manual review"
      });
      setMessage(`Appeal ${approved ? "approved" : "rejected"}.`);
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to review appeal.");
    }
  };

  const reviewComplaint = async (complaintId, approved) => {
    const draft = complaintReviewDrafts[complaintId] || {};
    try {
      setError("");
      await api.patch(`/admin/complaints/${complaintId}/review`, {
        approved,
        note: draft.note || (approved ? "Complaint resolved by operations" : "Complaint closed without action"),
        adjustmentAmount: approved ? Number(draft.adjustmentAmount || 0) : 0
      });
      setMessage(`Complaint ${approved ? "resolved" : "closed"}.`);
      setComplaintReviewDrafts((current) => {
        const next = { ...current };
        delete next[complaintId];
        return next;
      });
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to review complaint.");
    }
  };

  const bulkConfirmWeather = async () => {
    const eligible = filteredQueue.filter(
      (item) => !item.isSocialTrigger && item.eligibility === "VERIFIED" && item.decision === "ADMIN_REVIEW"
    );
    if (!eligible.length) {
      setMessage("No weather claims need bulk confirmation.");
      return;
    }

    try {
      setError("");
      await Promise.all(
        eligible.map((item) =>
          api.patch(`/admin/claims/${item._id}/review`, {
            approved: true,
            note: "Bulk weather approval from payout queue"
          })
        )
      );
      setMessage(`${eligible.length} weather claims confirmed.`);
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to bulk confirm weather claims.");
    }
  };

  const toggleManualFlag = async (rider, flagged) => {
    try {
      setError("");
      await api.patch(`/admin/riders/${rider._id}/flag`, {
        flagged,
        reason: flagged ? "Flagged from rider management drawer" : ""
      });
      setMessage(`Rider ${flagged ? "flagged" : "cleared"} successfully.`);
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update rider flag.");
    }
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    try {
      setError("");
      await api.patch("/admin/settings", settingsDraft);
      setMessage("System settings saved.");
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to save settings.");
    }
  };

  if (loading) {
    return (
      <div className="admin-app flex min-h-screen items-center justify-center" data-theme={theme}>
        <div className="admin-panel rounded-[28px] px-8 py-6 text-lg">Loading admin portal...</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="admin-app flex min-h-screen items-center justify-center" data-theme={theme}>
        <div className="admin-panel rounded-[28px] px-8 py-6 text-lg">{error || "Admin portal unavailable."}</div>
      </div>
    );
  }

  return (
    <div className="admin-app" data-theme={theme} style={{ background: "var(--admin-bg)" }}>
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex flex-col justify-between border-r px-6 py-8" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          <div>
            <div>
              <p className="text-3xl font-bold" style={{ color: "var(--admin-accent)" }}>WEMA Admin</p>
              <p className="mt-2 text-sm admin-subtle">Income protection control center</p>
            </div>

            <nav className="mt-10 space-y-2">
              {SECTION_ITEMS.map((item) => (
                <button
                  key={item.key}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition"
                  style={{
                    background: activeSection === item.key ? "var(--admin-accent-soft)" : "transparent",
                    color: activeSection === item.key ? "var(--admin-accent)" : "var(--admin-text)"
                  }}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                >
                  <span>{item.label}</span>
                  {activeSection === item.key ? <span>*</span> : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--admin-surface-soft)" }}>
              <p className="text-xs uppercase tracking-[0.22em] admin-subtle">System status</p>
              <p className="mt-2 text-sm font-semibold" style={{ color: "var(--admin-success)" }}>Active</p>
              <p className="mt-1 text-xs admin-subtle">{selectedState} command center</p>
            </div>
          </div>
        </aside>

        <main className="px-5 py-5 md:px-8 md:py-6">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] p-5 admin-panel md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] admin-subtle">Dashboard Overview</p>
              <h1 className="mt-2 text-3xl font-semibold">{SECTION_ITEMS.find((item) => item.key === activeSection)?.label}</h1>
              <p className="mt-1 text-sm admin-subtle">State scope: {selectedState || "All States"}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select className="rounded-2xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} value={selectedState} onChange={changeState}>
                {(dashboard.adminScope?.availableStates || []).map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <button className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} type="button" onClick={changeTheme}>
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={runWeatherSync}>
                Run Weather Sync
              </button>
              <button className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} type="button" onClick={runDemoSeed}>
                Generate Demo Data
              </button>
            </div>
          </header>

          {message ? (
            <div className="mb-4 rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "var(--admin-success)" }}>
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(220,38,38,0.12)", color: "var(--admin-danger)" }}>
              {error}
            </div>
          ) : null}

          {activeSection === "overview" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total Registered Riders"
                  value={dashboard.metrics?.totalRegisteredRiders || 0}
                  note={dashboard.metrics?.totalRegisteredRidersNote || "Across current scope"}
                />
                <MetricCard
                  label="Riders in Active Calamity"
                  value={dashboard.metrics?.ridersInActiveCalamityZone || 0}
                  note={dashboard.metrics?.ridersInActiveZoneNote || "Live trigger overlap"}
                  accent="var(--admin-danger)"
                />
                <MetricCard
                  label="Total Payouts This Week"
                  value={formatCurrency(dashboard.metrics?.totalPayoutsThisWeek || 0)}
                  note={dashboard.metrics?.totalPayoutsThisWeekNote || "All auto and manual payouts"}
                  accent="var(--admin-accent)"
                />
                <MetricCard
                  label="Premium Pool Balance"
                  value={formatCurrency(dashboard.metrics?.premiumPoolBalance || 0)}
                  note={dashboard.metrics?.premiumPoolNote || "Reserve position"}
                  accent="var(--admin-success)"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
                <AdminSection
                  title="Live Calamity Map"
                  subtitle="Active triggers across selected scope with eligibility overlay."
                >
                  <MapGrid triggers={dashboard.mapTriggers || []} />
                </AdminSection>

                <AdminSection title="Recent Trigger Feed" subtitle="Alerts fired in the last 24 hours.">
                  <div className="space-y-3">
                    {(dashboard.recentTriggerFeed || []).map((item) => (
                      <div key={item._id} className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                        <div className="flex items-center justify-between">
                          <Tag color={item.color} soft={`${item.color}22`}>{item.label}</Tag>
                          <span className="text-xs admin-subtle">{formatDate(item.detectedAt)}</span>
                        </div>
                        <p className="mt-2 font-semibold">{item.city} - {item.zoneCode}</p>
                        <p className="mt-1 text-sm admin-subtle">{item.eligibleRiders} riders eligible</p>
                      </div>
                    ))}
                    {!dashboard.recentTriggerFeed?.length ? (
                      <p className="text-sm admin-subtle">No triggers in the last 24 hours.</p>
                    ) : null}
                  </div>
                </AdminSection>
              </div>
            </div>
          ) : null}

          {activeSection === "payouts" ? (
            <div className="space-y-6">
              <AdminSection
                title="Payout Queue"
                subtitle="Review and confirm payout decisions by rider and event type."
                actions={
                  <button
                    className="rounded-2xl px-4 py-3 text-sm font-semibold"
                    style={{ background: "var(--admin-accent)", color: "#fff" }}
                    type="button"
                    onClick={bulkConfirmWeather}
                  >
                    Bulk confirm weather
                  </button>
                }
              >
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <input
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }}
                    placeholder="Search rider or zone"
                    value={queueFilters.search}
                    onChange={(event) => setQueueFilters((prev) => ({ ...prev, search: event.target.value }))}
                  />
                  <select
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }}
                    value={queueFilters.zone}
                    onChange={(event) => setQueueFilters((prev) => ({ ...prev, zone: event.target.value }))}
                  >
                    <option value="ALL">All Zones</option>
                    {availableZones.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }}
                    value={queueFilters.type}
                    onChange={(event) => setQueueFilters((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="ALL">All Types</option>
                    {EVENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }}
                    value={queueFilters.status}
                    onChange={(event) => setQueueFilters((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="ALL">All Statuses</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr>
                        <th className="px-4 py-3">Rider</th>
                        <th className="px-4 py-3">City</th>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3">Calamity</th>
                        <th className="px-4 py-3">Eligibility</th>
                        <th className="px-4 py-3">Payout</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.map((item) => (
                        <tr key={item._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-4 py-3">{item.riderName}</td>
                          <td className="px-4 py-3">{item.city || "-"}</td>
                          <td className="px-4 py-3">{item.zone}</td>
                          <td className="px-4 py-3">{item.calamityType}</td>
                          <td className="px-4 py-3">
                            <Tag color={item.eligibility === "VERIFIED" ? "var(--admin-success)" : item.eligibility === "INELIGIBLE" ? "var(--admin-danger)" : "var(--admin-accent)"} soft="rgba(37,99,235,0.12)">{item.eligibility}</Tag>
                          </td>
                          <td className="px-4 py-3">{formatCurrency(item.payoutAmount)}</td>
                          <td className="px-4 py-3">{item.transferStatus}</td>
                          <td className="px-4 py-3">
                            {item.decision === "ADMIN_REVIEW" ? (
                              <button
                                className="rounded-xl px-3 py-2 text-xs font-semibold"
                                style={{ background: "var(--admin-accent)", color: "#fff" }}
                                type="button"
                                onClick={() => reviewClaim(item._id, true)}
                              >
                                Confirm
                              </button>
                            ) : (
                              <span className="text-xs admin-subtle">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!filteredQueue.length ? (
                        <tr>
                          <td colSpan="8" className="px-4 py-6 text-sm admin-subtle">No payouts in queue.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </div>
          ) : null}

          {activeSection === "triggers" ? (
            <div className="space-y-6">
              <AdminSection title="Trigger Management" subtitle="Monitor automated triggers and approve social events.">
                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3">Eligible</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard.triggerManagement?.rows || []).map((row) => (
                        <tr key={row._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-4 py-3">{row.eventType}</td>
                          <td className="px-4 py-3">{row.sourceType}</td>
                          <td className="px-4 py-3">
                            <Tag color={row.statusColor} soft={`${row.statusColor}22`}>{row.status}</Tag>
                          </td>
                          <td className="px-4 py-3">{row.city} - {row.zoneCode}</td>
                          <td className="px-4 py-3">{row.eligibleRiders}</td>
                          <td className="px-4 py-3">
                            {row.requiresConfirmation ? (
                              <div className="flex gap-2">
                                <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-success)", color: "#fff" }} type="button" onClick={() => decideSocialTrigger(row._id, true)}>Confirm</button>
                                <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-danger)", color: "#fff" }} type="button" onClick={() => decideSocialTrigger(row._id, false)}>Dismiss</button>
                              </div>
                            ) : (
                              <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={() => processEvent(row._id)}>Process</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!dashboard.triggerManagement?.rows?.length ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-sm admin-subtle">No triggers available.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </AdminSection>

              <AdminSection title="Manual Trigger Creation" subtitle="Create a new trigger manually for demo validation.">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={submitEvent}>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={eventForm.sourceType} onChange={(event) => setEventForm((prev) => ({ ...prev, sourceType: event.target.value }))}>
                    <option value="WEATHER">Weather</option>
                    <option value="SOCIAL">Social</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={eventForm.eventType} onChange={(event) => setEventForm((prev) => ({ ...prev, eventType: event.target.value }))}>
                    {EVENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="City" value={eventForm.city} onChange={(event) => setEventForm((prev) => ({ ...prev, city: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Zone code" value={eventForm.zoneCode} onChange={(event) => setEventForm((prev) => ({ ...prev, zoneCode: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Center lat" value={eventForm.centerLat} onChange={(event) => setEventForm((prev) => ({ ...prev, centerLat: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Center lng" value={eventForm.centerLng} onChange={(event) => setEventForm((prev) => ({ ...prev, centerLng: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Radius (km)" value={eventForm.radiusKm} onChange={(event) => setEventForm((prev) => ({ ...prev, radiusKm: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Severity label" value={eventForm.severityLabel} onChange={(event) => setEventForm((prev) => ({ ...prev, severityLabel: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Severity factor" value={eventForm.severityFactor} onChange={(event) => setEventForm((prev) => ({ ...prev, severityFactor: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Loss hours" value={eventForm.lossHours} onChange={(event) => setEventForm((prev) => ({ ...prev, lossHours: event.target.value }))} />
                  <div className="md:col-span-2">
                    <button className="rounded-2xl px-5 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="submit">
                      Create trigger
                    </button>
                  </div>
                </form>
              </AdminSection>
            </div>
          ) : null}

          {activeSection === "support" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard
                  label="Open Appeals"
                  value={dashboard.openAppeals?.length || 0}
                  note="Pending manual claim reviews"
                  accent="var(--admin-accent)"
                />
                <MetricCard
                  label="Open Complaints"
                  value={dashboard.openComplaints?.length || 0}
                  note="Rider-raised support issues"
                  accent="var(--admin-danger)"
                />
              </div>

              <AdminSection title="Complaint Review" subtitle="Review rider complaints and close them with an operations decision.">
                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr>
                        <th className="px-4 py-3">Rider</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3">Claim Link</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard.complaints || []).map((complaint) => {
                        const riderName =
                          complaint.riderId?.userId?.name ||
                          complaint.riderId?.name ||
                          complaint.riderId?.userId?.email ||
                          "Unknown rider";
                        const canReview = ["OPEN", "UNDER_REVIEW"].includes(complaint.status);
                        const reviewDraft = complaintReviewDrafts[complaint._id] || {};

                        return (
                          <tr key={complaint._id} className="border-t align-top" style={{ borderColor: "var(--admin-border)" }}>
                            <td className="px-4 py-3">{riderName}</td>
                            <td className="px-4 py-3 font-medium">{complaint.subject}</td>
                            <td className="px-4 py-3">{complaint.category?.replaceAll("_", " ") || "-"}</td>
                            <td className="px-4 py-3">
                              <Tag
                                color={
                                  complaint.status === "RESOLVED"
                                    ? "var(--admin-success)"
                                    : complaint.status === "REJECTED"
                                      ? "var(--admin-danger)"
                                      : "var(--admin-accent)"
                                }
                                soft={
                                  complaint.status === "RESOLVED"
                                    ? "rgba(22,163,74,0.12)"
                                    : complaint.status === "REJECTED"
                                      ? "rgba(220,38,38,0.12)"
                                      : "rgba(37,99,235,0.12)"
                                }
                              >
                                {complaint.status}
                              </Tag>
                            </td>
                            <td className="px-4 py-3">{formatDate(complaint.createdAt)}</td>
                            <td className="px-4 py-3">
                              {complaint.relatedClaimId?._id ? (
                                <div>
                                  <p className="font-medium">{complaint.relatedClaimId.eventId?.eventType?.replaceAll("_", " ") || "Linked claim"}</p>
                                  <p className="mt-1 text-xs admin-subtle">{formatCurrency(complaint.relatedClaimId.cappedPayout || 0)}</p>
                                </div>
                              ) : (
                                <span className="text-xs admin-subtle">No linked claim</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p>{complaint.message}</p>
                              {complaint.resolutionNote ? (
                                <p className="mt-2 text-xs admin-subtle">Resolution: {complaint.resolutionNote}</p>
                              ) : null}
                              {complaint.adjustmentAmount ? (
                                <p className="mt-2 text-xs" style={{ color: "var(--admin-success)" }}>
                                  Adjustment credited: {formatCurrency(complaint.adjustmentAmount)}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              {canReview ? (
                                <div className="space-y-2">
                                  <input
                                    className="w-full rounded-xl border px-3 py-2 text-xs"
                                    style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}
                                    placeholder="Resolution note"
                                    value={reviewDraft.note || ""}
                                    onChange={(event) =>
                                      setComplaintReviewDrafts((current) => ({
                                        ...current,
                                        [complaint._id]: { ...current[complaint._id], note: event.target.value }
                                      }))
                                    }
                                  />
                                  {complaint.category === "WRONG_CALCULATION" ? (
                                    <input
                                      className="w-full rounded-xl border px-3 py-2 text-xs"
                                      style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}
                                      placeholder="Adjustment amount"
                                      value={reviewDraft.adjustmentAmount || ""}
                                      onChange={(event) =>
                                        setComplaintReviewDrafts((current) => ({
                                          ...current,
                                          [complaint._id]: { ...current[complaint._id], adjustmentAmount: event.target.value }
                                        }))
                                      }
                                    />
                                  ) : null}
                                  <div className="flex gap-2">
                                    <button
                                      className="rounded-xl px-3 py-2 text-xs font-semibold"
                                      style={{ background: "var(--admin-success)", color: "#fff" }}
                                      type="button"
                                      onClick={() => reviewComplaint(complaint._id, true)}
                                    >
                                      Resolve
                                    </button>
                                    <button
                                      className="rounded-xl px-3 py-2 text-xs font-semibold"
                                      style={{ background: "var(--admin-danger)", color: "#fff" }}
                                      type="button"
                                      onClick={() => reviewComplaint(complaint._id, false)}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs admin-subtle">Reviewed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!dashboard.complaints?.length ? (
                        <tr>
                          <td colSpan="8" className="px-4 py-6 text-sm admin-subtle">No complaints available.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </AdminSection>

              <AdminSection title="Appeal Review" subtitle="Review rider claim appeals and decide whether the claim should proceed.">
                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr>
                        <th className="px-4 py-3">Claim</th>
                        <th className="px-4 py-3">Event</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard.appeals || []).map((appeal) => {
                        const canReview = ["OPEN", "UNDER_REVIEW"].includes(appeal.status);
                        const eventLabel = appeal.claimId?.eventId?.eventType?.replaceAll("_", " ") || "-";

                        return (
                          <tr key={appeal._id} className="border-t align-top" style={{ borderColor: "var(--admin-border)" }}>
                            <td className="px-4 py-3">{appeal.claimId?._id || "-"}</td>
                            <td className="px-4 py-3">{eventLabel}</td>
                            <td className="px-4 py-3">
                              <Tag
                                color={
                                  appeal.status === "RESOLVED"
                                    ? "var(--admin-success)"
                                    : appeal.status === "REJECTED"
                                      ? "var(--admin-danger)"
                                      : "var(--admin-accent)"
                                }
                                soft={
                                  appeal.status === "RESOLVED"
                                    ? "rgba(22,163,74,0.12)"
                                    : appeal.status === "REJECTED"
                                      ? "rgba(220,38,38,0.12)"
                                      : "rgba(37,99,235,0.12)"
                                }
                              >
                                {appeal.status}
                              </Tag>
                            </td>
                            <td className="px-4 py-3">{formatDate(appeal.createdAt)}</td>
                            <td className="px-4 py-3">{appeal.reason}</td>
                            <td className="px-4 py-3">
                              {canReview ? (
                                <div className="flex gap-2">
                                  <button
                                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                                    style={{ background: "var(--admin-success)", color: "#fff" }}
                                    type="button"
                                    onClick={() => reviewAppeal(appeal._id, true)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                                    style={{ background: "var(--admin-danger)", color: "#fff" }}
                                    type="button"
                                    onClick={() => reviewAppeal(appeal._id, false)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs admin-subtle">Reviewed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!dashboard.appeals?.length ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-sm admin-subtle">No appeals available.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </div>
          ) : null}

          {activeSection === "fraud" ? (
            <AdminSection title="Fraud Flags" subtitle="Review anomaly scores and decide payouts.">
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                <table className="w-full text-left text-sm">
                  <thead style={{ background: "var(--admin-surface-soft)" }}>
                    <tr>
                      <th className="px-4 py-3">Rider</th>
                      <th className="px-4 py-3">Zone</th>
                      <th className="px-4 py-3">Risk</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.fraudManagement?.flags || []).map((item) => (
                      <tr key={item._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                        <td className="px-4 py-3">{item.rider}</td>
                        <td className="px-4 py-3">{item.zone}</td>
                        <td className="px-4 py-3">
                          <Tag color={item.riskTier === "HIGH" || item.riskTier === "REPEAT_HIGH" ? "var(--admin-danger)" : "var(--admin-accent)"} soft="rgba(239,68,68,0.12)">{item.riskTier}</Tag>
                        </td>
                        <td className="px-4 py-3">{item.reason}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-success)", color: "#fff" }} type="button" onClick={() => reviewClaim(item.claimId, true)}>Approve</button>
                            <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-danger)", color: "#fff" }} type="button" onClick={() => reviewClaim(item.claimId, false)}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!dashboard.fraudManagement?.flags?.length ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-sm admin-subtle">No fraud flags currently.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          ) : null}

          {activeSection === "riders" ? (
            <div className="space-y-6">
              <AdminSection title="Registered Riders" subtitle="Search and filter by zone, plan, and KYC status.">
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Search ID or name" value={riderFilters.search} onChange={(event) => setRiderFilters((prev) => ({ ...prev, search: event.target.value }))} />
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={riderFilters.zone} onChange={(event) => setRiderFilters((prev) => ({ ...prev, zone: event.target.value }))}>
                    <option value="ALL">All Zones</option>
                    {availableZones.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={riderFilters.plan} onChange={(event) => setRiderFilters((prev) => ({ ...prev, plan: event.target.value }))}>
                    <option value="ALL">All Plans</option>
                    {availablePlans.map((plan) => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={riderFilters.kyc} onChange={(event) => setRiderFilters((prev) => ({ ...prev, kyc: event.target.value }))}>
                    <option value="ALL">All KYC states</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="PENDING">Pending</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr>
                        <th className="px-4 py-3">Rider Details</th>
                        <th className="px-4 py-3">City</th>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">KYC Status</th>
                        <th className="px-4 py-3">Claims</th>
                        <th className="px-4 py-3">Join Date</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRiders.map((item) => (
                        <tr key={item._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs admin-subtle">{item.riderIdLabel}</p>
                          </td>
                          <td className="px-4 py-3">{item.city || "-"}</td>
                          <td className="px-4 py-3">{item.zone}</td>
                          <td className="px-4 py-3">{item.plan}</td>
                          <td className="px-4 py-3">
                            <Tag color={item.kycColor} soft={`${item.kycColor}22`}>{item.kycStatus}</Tag>
                          </td>
                          <td className="px-4 py-3">{item.claimsCount}</td>
                          <td className="px-4 py-3">{formatDate(item.joinDate)}</td>
                          <td className="px-4 py-3">
                            <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={() => setSelectedRider(item)}>View</button>
                          </td>
                        </tr>
                      ))}
                      {!filteredRiders.length ? (
                        <tr>
                          <td colSpan="8" className="px-4 py-6 text-sm admin-subtle">No riders match the filter.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </AdminSection>
            </div>
          ) : null}

          {activeSection === "pool" ? (
            <AdminSection title="Premium Pool Health" subtitle="Weekly balance and reserve buffer projection.">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Weekly Collected" value={formatCurrency(dashboard.premiumPoolHealth?.weeklyCollected || 0)} note="Total premiums collected" />
                <MetricCard label="Weekly Payouts" value={formatCurrency(dashboard.premiumPoolHealth?.weeklyPayouts || 0)} note="Total paid out" accent="var(--admin-danger)" />
                <MetricCard label="Reserve Buffer" value={formatCurrency(dashboard.premiumPoolHealth?.reserveBuffer || 0)} note="Target reserve" accent="var(--admin-success)" />
              </div>
              <div className="mt-4 rounded-2xl p-4 text-sm" style={{ background: "var(--admin-surface-soft)" }}>
                <p>Projected liability if all active triggers pay out: {formatCurrency(dashboard.premiumPoolHealth?.projectedLiability || 0)}</p>
                <p className="mt-2">Safe threshold: {formatCurrency(dashboard.premiumPoolHealth?.safeThreshold || 0)}</p>
              </div>
            </AdminSection>
          ) : null}

          {activeSection === "shifts" ? (
            <AdminSection title="Shift Activity Monitor" subtitle="Declared shifts and anomaly flags by zone.">
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                <table className="w-full text-left text-sm">
                  <thead style={{ background: "var(--admin-surface-soft)" }}>
                    <tr>
                      <th className="px-4 py-3">Rider</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Zone</th>
                      <th className="px-4 py-3">Shift Active</th>
                      <th className="px-4 py-3">Shift Start</th>
                      <th className="px-4 py-3">Shift End</th>
                      <th className="px-4 py-3">Anomaly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.shiftActivity || []).map((row) => (
                      <tr key={row._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                        <td className="px-4 py-3">{row.rider}</td>
                        <td className="px-4 py-3">{row.city || "-"}</td>
                        <td className="px-4 py-3">{row.zone}</td>
                        <td className="px-4 py-3">{row.shiftActive ? "ON" : "OFF"}</td>
                        <td className="px-4 py-3">{formatDate(row.shiftStart)}</td>
                        <td className="px-4 py-3">{formatDate(row.shiftEnd)}</td>
                        <td className="px-4 py-3">{row.anomalyFlag ? "Flagged" : "-"}</td>
                      </tr>
                    ))}
                    {!dashboard.shiftActivity?.length ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-sm admin-subtle">No shift data available.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          ) : null}

          {activeSection === "logs" ? (
            <AdminSection
              title="Alert & Trigger Log"
              subtitle="Audit trail of every API alert received."
              actions={<ExportButton rows={dashboard.alertLog || []} filename="trigger-log.csv" label="Export CSV" />}
            >
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={logFilter.source} onChange={(event) => setLogFilter((prev) => ({ ...prev, source: event.target.value }))}>
                  <option value="ALL">All Sources</option>
                  <option value="OpenWeather">OpenWeather</option>
                  <option value="News API">News API</option>
                  <option value="Order Volume">Order Volume</option>
                  <option value="Manual">Manual</option>
                </select>
                <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Search logs" value={logFilter.search} onChange={(event) => setLogFilter((prev) => ({ ...prev, search: event.target.value }))} />
              </div>
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                <table className="w-full text-left text-sm">
                  <thead style={{ background: "var(--admin-surface-soft)" }}>
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Data Type</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((row) => (
                      <tr key={row._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                        <td className="px-4 py-3">{formatDate(row.timestamp)}</td>
                        <td className="px-4 py-3">{row.source}</td>
                        <td className="px-4 py-3">{row.dataType}</td>
                        <td className="px-4 py-3">{row.region}</td>
                        <td className="px-4 py-3">{row.status}</td>
                      </tr>
                    ))}
                    {!filteredLogs.length ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-sm admin-subtle">No logs to show.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          ) : null}

          {activeSection === "settings" ? (
            <div className="space-y-6">
              <AdminSection title="System Settings" subtitle="Update trigger thresholds and payout caps.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                    <p className="text-sm font-semibold">Trigger Thresholds</p>
                    {Object.entries(settingsDraft?.triggerThresholds || {}).map(([key, value]) => (
                      <div key={key} className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm">{key}</span>
                        <input
                          className="w-28 rounded-xl border px-3 py-2 text-sm"
                          style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
                          value={value}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({
                              ...prev,
                              triggerThresholds: { ...prev.triggerThresholds, [key]: event.target.value }
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                    <p className="text-sm font-semibold">Payout Caps (weekly)</p>
                    {Object.entries(settingsDraft?.payoutCaps || {}).map(([key, value]) => (
                      <div key={key} className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm">{key}</span>
                        <input
                          className="w-28 rounded-xl border px-3 py-2 text-sm"
                          style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}
                          value={value}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({
                              ...prev,
                              payoutCaps: { ...prev.payoutCaps, [key]: event.target.value }
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                    <p className="text-sm font-semibold">Notification Channels</p>
                    <label className="mt-3 flex items-center gap-3 text-sm">
                      <input type="checkbox" checked={settingsDraft?.notificationPreferences?.email || false} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, notificationPreferences: { ...prev.notificationPreferences, email: event.target.checked } }))} />
                      Email
                    </label>
                    <label className="mt-3 flex items-center gap-3 text-sm">
                      <input type="checkbox" checked={settingsDraft?.notificationPreferences?.sms || false} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, notificationPreferences: { ...prev.notificationPreferences, sms: event.target.checked } }))} />
                      SMS
                    </label>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                    <p className="text-sm font-semibold">Reserve Buffer Target</p>
                    <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} value={settingsDraft?.reserveBufferTarget || ""} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, reserveBufferTarget: event.target.value }))} />
                    <p className="mt-2 text-xs admin-subtle">Target reserve amount to keep pool healthy.</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                    <p className="text-sm font-semibold">Safe Pool Threshold</p>
                    <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} value={settingsDraft?.safePoolThreshold || ""} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, safePoolThreshold: event.target.value }))} />
                    <label className="mt-4 flex items-center gap-3 text-sm">
                      <input type="checkbox" checked={settingsDraft?.autoApproveLowRisk || false} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, autoApproveLowRisk: event.target.checked }))} />
                      Auto-approve low risk claims
                    </label>
                  </div>
                </div>
                <div className="mt-5">
                  <button className="rounded-2xl px-5 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={saveSettings}>
                    Save changes
                  </button>
                </div>
              </AdminSection>
            </div>
          ) : null}
        </main>
      </div>

      {selectedRider ? (
        <div className="fixed inset-0 flex items-center justify-end bg-black/40 px-4 py-8" role="dialog">
          <div className="admin-panel w-full max-w-md rounded-[28px] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Rider Profile</h3>
              <button className="text-sm font-semibold" type="button" onClick={() => setSelectedRider(null)}>Close</button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="admin-subtle">Name:</span> {selectedRider.name}</p>
              <p><span className="admin-subtle">Rider ID:</span> {selectedRider.riderIdLabel}</p>
              <p><span className="admin-subtle">City:</span> {selectedRider.city || "-"}</p>
              <p><span className="admin-subtle">Zone:</span> {selectedRider.zone}</p>
              <p><span className="admin-subtle">Plan:</span> {selectedRider.plan}</p>
              <p><span className="admin-subtle">Fraud score:</span> {selectedRider.fraudScore}</p>
              <p><span className="admin-subtle">Claim history:</span> {selectedRider.claimCount} claims</p>
              <p><span className="admin-subtle">Manual flag:</span> {selectedRider.manualFlag ? "Yes" : "No"}</p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold"
                style={{ background: selectedRider.manualFlag ? "var(--admin-danger)" : "var(--admin-accent)", color: "#fff" }}
                type="button"
                onClick={() => toggleManualFlag(selectedRider, !selectedRider.manualFlag)}
              >
                {selectedRider.manualFlag ? "Clear Flag" : "Flag Rider"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

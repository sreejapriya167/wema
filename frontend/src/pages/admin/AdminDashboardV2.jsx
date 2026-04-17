import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import LiveMapDisplay from "../../components/LiveMapDisplay.jsx";

const NAV_GROUPS = [
  {
    label: "Dashboard",
    items: [
      { key: "overview", label: "Overview" },
      { key: "liveMap", label: "Live Map" }
    ]
  },
  {
    label: "Operations",
    items: [
      { key: "payoutQueue", label: "Payout Queue" },
      { key: "triggerPanel", label: "Trigger Panel" },
      { key: "alertTimeline", label: "Alert Timeline" }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { key: "dataSources", label: "Data Source Health" },
      { key: "logicEngine", label: "Trigger Logic Engine" },
      { key: "ingestionLogs", label: "Ingestion Logs" }
    ]
  },
  {
    label: "Risk Control",
    items: [{ key: "fraud", label: "Fraud Detection" }]
  },
  {
    label: "Users",
    items: [
      { key: "riders", label: "Riders" },
      { key: "shifts", label: "Shifts" }
    ]
  },
  {
    label: "System",
    items: [{ key: "settings", label: "Settings" }]
  }
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

function timeAgo(value) {
  if (!value) return "just now";
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day ago`;
}

function statusColor(status) {
  const normalized = String(status || "").toUpperCase();
  if (["PAID", "APPROVED", "VERIFIED", "SUCCESS", "ONLINE", "SYNCED", "MONITORING", "RESOLVED"].includes(normalized)) {
    return { color: "var(--admin-success)", soft: "rgba(22,163,74,0.12)" };
  }
  if (["PENDING", "PROCESSING", "ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION", "DELAYED", "QUIET"].includes(normalized)) {
    return { color: "var(--admin-accent)", soft: "rgba(37,99,235,0.12)" };
  }
  if (["REJECTED", "FAILED", "OFFLINE", "DOWN", "HIGH", "REPEAT_HIGH", "NEEDS ATTENTION"].includes(normalized)) {
    return { color: "var(--admin-danger)", soft: "rgba(220,38,38,0.12)" };
  }
  return { color: "var(--admin-text)", soft: "var(--admin-surface-soft)" };
}

function Tag({ children, tone }) {
  const palette = tone || statusColor(children);
  return (
    <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: palette.soft, color: palette.color }}>
      {children}
    </span>
  );
}

function Section({ title, subtitle, actions, children }) {
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

function MetricCard({ label, value, note, accent }) {
  return (
    <div className="admin-panel rounded-[24px] p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.24em] admin-subtle">{label}</p>
      <p className="mt-4 text-4xl font-semibold" style={{ color: accent || "var(--admin-text)" }}>{value}</p>
      {note ? <p className="mt-2 text-sm admin-subtle">{note}</p> : null}
    </div>
  );
}

function ExportButton({ rows, filename, label }) {
  const handleExport = () => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`).join(","))
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
    <button className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={handleExport}>
      {label}
    </button>
  );
}

function EmptyState({ children }) {
  return <div className="rounded-2xl border px-4 py-6 text-sm admin-subtle" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>{children}</div>;
}

function MiniMap({ triggers, onSelect }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {triggers.length ? triggers.map((trigger) => (
        <button
          key={trigger._id}
          type="button"
          className="rounded-2xl border p-4 text-left transition hover:translate-y-[-1px]"
          style={{ borderColor: "var(--admin-border)", background: "linear-gradient(180deg, var(--admin-surface-soft), transparent)" }}
          onClick={() => onSelect?.(trigger)}
        >
          <Tag tone={{ color: trigger.color || "var(--admin-accent)", soft: `${trigger.color || "#2563eb"}22` }}>{trigger.label}</Tag>
          <p className="mt-3 text-lg font-semibold">{trigger.city} / {trigger.zoneCode}</p>
          <p className="mt-1 text-sm admin-subtle">{trigger.eligibleRiders} eligible riders in this trigger zone</p>
          <div className="mt-4 h-32 rounded-2xl" style={{ background: `radial-gradient(circle at 55% 45%, ${(trigger.color || "#2563eb")}55, transparent 35%), linear-gradient(135deg, rgba(37,99,235,0.08), rgba(15,23,42,0.1))` }} />
        </button>
      )) : <EmptyState>No active trigger zones to map right now.</EmptyState>}
    </div>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedState, setSelectedState] = useState("");
  const [theme, setTheme] = useState("light");
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [testingSource, setTestingSource] = useState("");
  const [queueFilters, setQueueFilters] = useState({ zone: "ALL", type: "ALL", status: "ALL", search: "" });
  const [riderFilters, setRiderFilters] = useState({ search: "", zone: "ALL", plan: "ALL", kyc: "ALL" });
  const [logFilter, setLogFilter] = useState({ source: "ALL", search: "" });
  const [eventForm, setEventForm] = useState({
    sourceType: "SOCIAL",
    eventType: "BANDH",
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

  const activeNavItem = useMemo(
    () => NAV_GROUPS.flatMap((group) => group.items).find((item) => item.key === activeSection),
    [activeSection]
  );

  const loadDashboard = async (requestedState = selectedState) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/dashboard", {
        params: requestedState ? { state: requestedState } : {}
      });
      const payload = data?.data || {};
      console.groupCollapsed("[AdminDashboard] backend payload");
      console.log("Data Source Health:", payload.dataSourceHealth || []);
      console.log("Active Events:", payload.activeEvents || []);
      console.log("Recent Triggers:", payload.recentTriggerFeed || []);
      console.log("Metrics:", payload.metrics || {});
      console.log("Full Dashboard Response:", payload);
      console.groupEnd();
      setDashboard(payload);
      setSelectedState(payload.adminScope?.selectedState || "");
      setTheme(payload.adminScope?.theme || "light");
      setSelectedAlert((current) => current || payload.alertConfirmation || payload.socialTriggerPanel?.[0] || payload.mapTriggers?.[0] || null);
      setSettingsDraft({
        state: payload.adminScope?.selectedState,
        triggerThresholds: { ...payload.settings?.triggerThresholds },
        payoutCaps: { ...payload.settings?.payoutCaps },
        notificationPreferences: { ...payload.settings?.notificationPreferences },
        reserveBufferTarget: payload.settings?.reserveBufferTarget,
        safePoolThreshold: payload.settings?.safePoolThreshold,
        autoApproveLowRisk: payload.settings?.autoApproveLowRisk
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
    () => [...new Set((dashboard?.riderManagement || []).map((rider) => rider.zone))].filter(Boolean).sort(),
    [dashboard]
  );

  const availablePlans = useMemo(
    () => [...new Set((dashboard?.riderManagement || []).map((rider) => rider.plan))].filter(Boolean).sort(),
    [dashboard]
  );

  const filteredQueue = useMemo(() => {
    const search = queueFilters.search.trim().toLowerCase();
    return (dashboard?.payoutQueue || []).filter((item) => {
      const matchesZone = queueFilters.zone === "ALL" || item.zone === queueFilters.zone;
      const matchesType = queueFilters.type === "ALL" || item.calamityType === queueFilters.type;
      const matchesStatus = queueFilters.status === "ALL" || item.transferStatus === queueFilters.status || item.decision === queueFilters.status;
      const matchesSearch = !search || `${item.riderName} ${item.zone} ${item.city}`.toLowerCase().includes(search);
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
      console.log("⛅ Running weather sync...");
      const result = await api.post("/admin/weather-sync");
      console.log("🌤️ Weather Sync Complete - Response:", result.data);
      setMessage("Weather sync completed and new triggers were evaluated.");
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to run weather sync.");
    }
  };

  const runDemoSeed = async () => {
    try {
      setError("");
      console.log("🌱 Seeding demo data for state:", selectedState);
      const result = await api.post("/admin/demo/seed", { state: selectedState });
      console.log("🎯 Demo Seed Response:", result.data);
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
        center: { lat: Number(eventForm.centerLat), lng: Number(eventForm.centerLng) },
        radiusKm: Number(eventForm.radiusKm),
        affectedPolygon: [{ lat: Number(eventForm.centerLat), lng: Number(eventForm.centerLng) }],
        severity: { label: eventForm.severityLabel, factor: Number(eventForm.severityFactor) },
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
        note: approved ? "Confirmed from social trigger panel" : "Dismissed from social trigger panel"
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
        note: approved ? "Approved from payout queue" : "Rejected from payout queue"
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

  const toggleManualFlag = async (rider, flagged) => {
    try {
      setError("");
      await api.patch(`/admin/riders/${rider._id}/flag`, {
        flagged,
        reason: flagged ? "Flagged from rider management panel" : ""
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

  const testDataSource = async (sourceKey) => {
    setTestingSource(sourceKey);
    setError("");
    try {
      console.log(`🔄 Testing data source: ${sourceKey}`);
      if (sourceKey === "WEATHER_API") {
        console.log("📡 Calling POST /admin/weather-sync");
        const result = await api.post("/admin/weather-sync");
        console.log("📊 Weather Sync Response:", result.data);
        setMessage("Weather source test completed.");
      } else {
        console.log(`📡 Calling GET /admin/dashboard for ${sourceKey}`);
        const result = await api.get("/admin/dashboard", {
          params: selectedState ? { state: selectedState } : {}
        });
        console.log(`✅ ${sourceKey} Response - Data Source Health:`, result?.data?.data?.dataSourceHealth || []);
        setMessage(`${sourceKey.replaceAll("_", " ")} health check completed.`);
      }
      await loadDashboard(selectedState);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to test data source.");
    } finally {
      setTestingSource("");
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

  const pendingPayoutCount = filteredQueue.filter((item) => ["ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION"].includes(item.decision)).length;
  const fraudFlaggedPayouts = filteredQueue.filter((item) => ["HIGH", "REPEAT_HIGH"].includes(item.fraudRiskTier)).length;

  return (
    <div className="admin-app" data-theme={theme} style={{ background: "var(--admin-bg)" }}>
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col justify-between border-r px-6 py-8" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          <div>
            <div>
              <p className="ui-brand text-3xl font-bold" style={{ color: "var(--admin-accent)" }}>WEMA Admin</p>
              <p className="mt-2 text-sm admin-subtle">System monitoring and operations command center</p>
            </div>

            <div className="mt-10 space-y-7">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.24em] admin-subtle">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
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
                        {activeSection === item.key ? <span className="text-xs">•</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--admin-surface-soft)" }}>
              <p className="text-xs uppercase tracking-[0.22em] admin-subtle">System Status</p>
              <p className="mt-2 text-sm font-semibold" style={{ color: dashboard.systemStatus?.label === "Monitoring Active" ? "var(--admin-success)" : "var(--admin-danger)" }}>
                {dashboard.systemStatus?.label || "Needs Attention"}
              </p>
              <p className="mt-1 text-xs admin-subtle">{dashboard.systemStatus?.note}</p>
            </div>
            <p className="text-xs admin-subtle">Last backend refresh: {formatDate(dashboard.generatedAt)}</p>
          </div>
        </aside>

        <main className="px-5 py-5 md:px-8 md:py-6">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] p-5 admin-panel md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] admin-subtle">{NAV_GROUPS.find((group) => group.items.some((item) => item.key === activeSection))?.label || "Dashboard"}</p>
              <h1 className="mt-2 text-3xl font-semibold">{activeNavItem?.label || "Overview"}</h1>
              <p className="mt-1 text-sm admin-subtle">State scope: {selectedState || "All States"} · Last updated {timeAgo(dashboard.generatedAt)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select className="rounded-2xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} value={selectedState} onChange={changeState}>
                {(dashboard.adminScope?.availableStates || []).map((state) => <option key={state} value={state}>{state}</option>)}
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

          {message ? <div className="mb-4 rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(22,163,74,0.12)", color: "var(--admin-success)" }}>{message}</div> : null}
          {error ? <div className="mb-4 rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(220,38,38,0.12)", color: "var(--admin-danger)" }}>{error}</div> : null}

          {activeSection === "overview" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Registered Riders" value={dashboard.metrics?.totalRegisteredRiders || 0} note="Across selected operational scope" />
                <MetricCard label="Active Calamity Riders" value={dashboard.metrics?.ridersInActiveCalamityZone || 0} note="Currently overlapping protected zones" accent="var(--admin-danger)" />
                <MetricCard label="Total Payouts This Week" value={formatCurrency(dashboard.metrics?.totalPayoutsThisWeek || 0)} note={`${pendingPayoutCount} waiting for review`} accent="var(--admin-accent)" />
                <MetricCard label="Premium Pool Balance" value={formatCurrency(dashboard.metrics?.premiumPoolBalance || 0)} note={`Healthy feeds ${dashboard.systemStatus?.healthyFeeds}/${dashboard.systemStatus?.totalFeeds}`} accent="var(--admin-success)" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
                <Section title="Live Map" subtitle="Active trigger zones and rider impact as reported by the backend.">
                  <div style={{ height: "300px", width: "100%" }}>
                    <LiveMapDisplay
                      mapTriggers={dashboard.mapTriggers || []}
                      riderLocations={dashboard.riderManagement || []}
                      selectedState={selectedState}
                    />
                  </div>
                </Section>

                <Section title="Recent Activity" subtitle="Operations, fraud, and trigger events in time order.">
                  <div className="space-y-3">
                    {(dashboard.activityFeed || []).map((item) => (
                      <div key={item._id} className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{item.title}</p>
                          <Tag>{item.tone}</Tag>
                        </div>
                        <p className="mt-1 text-sm admin-subtle">{item.detail}</p>
                        <p className="mt-2 text-xs admin-subtle">{timeAgo(item.timestamp)}</p>
                      </div>
                    ))}
                    {!dashboard.activityFeed?.length ? <EmptyState>No recent activity for the current scope.</EmptyState> : null}
                  </div>
                </Section>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {(dashboard.dataSourceHealth || []).map((source) => (
                  <div key={source.key} className="admin-panel rounded-[24px] p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold">{source.label}</p>
                      <Tag>{source.status}</Tag>
                    </div>
                    <p className="mt-3 text-sm admin-subtle">{source.note}</p>
                    <p className="mt-4 text-sm">Latency: {source.latencyMs ? `${source.latencyMs} ms` : "Not available"}</p>
                    <p className="mt-1 text-xs admin-subtle">Last updated {formatDate(source.lastUpdatedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === "liveMap" ? (
            <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
              <Section title="Live Map" subtitle="Watch zone-based trigger impact in near real time.">
                <div style={{ height: "500px", width: "100%" }}>
                  <LiveMapDisplay
                    mapTriggers={dashboard.mapTriggers || []}
                    riderLocations={dashboard.riderManagement || []}
                    selectedState={selectedState}
                  />
                </div>
              </Section>
              <Section title="Alert Confirmation" subtitle="Impact, map center, and affected riders for the selected alert.">
                {selectedAlert ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] admin-subtle">Primary Alert Status</p>
                          <p className="mt-2 text-2xl font-semibold">{selectedAlert.title || selectedAlert.label}</p>
                        </div>
                        <Tag>{selectedAlert.status || "ACTIVE"}</Tag>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] admin-subtle">Location</p>
                          <p className="mt-2 font-medium">{selectedAlert.locationLabel || `${selectedAlert.city} / ${selectedAlert.zoneCode}`}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] admin-subtle">Impact Projection</p>
                          <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--admin-danger)" }}>
                            {selectedAlert.impactProjection?.projectedDropPercent ? `-${selectedAlert.impactProjection.projectedDropPercent}%` : `${selectedAlert.eligibleRiders || 0} riders`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12), transparent)" }}>
                      <p className="font-semibold">Automated Response</p>
                      <p className="mt-2 text-sm admin-subtle">{selectedAlert.automatedResponse || dashboard.alertConfirmation?.automatedResponse || "Trigger confirmation will route eligible riders into protected processing."}</p>
                    </div>
                    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                      <p className="font-semibold">Affected riders</p>
                      <div className="mt-3 space-y-2">
                        {(selectedAlert.affectedRiders || dashboard.alertConfirmation?.affectedRiders || []).map((rider) => (
                          <div key={rider._id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3" style={{ background: "var(--admin-surface)" }}>
                            <div>
                              <p className="font-medium">{rider.name}</p>
                              <p className="text-xs admin-subtle">{rider.city} · {rider.plan}</p>
                            </div>
                            <Tag>{rider.shiftActive ? "ACTIVE_SHIFT" : "OFF_SHIFT"}</Tag>
                          </div>
                        ))}
                        {!(selectedAlert.affectedRiders || dashboard.alertConfirmation?.affectedRiders || []).length ? <EmptyState>No rider details available for this alert yet.</EmptyState> : null}
                      </div>
                    </div>
                  </div>
                ) : <EmptyState>Select a live alert to inspect its impact and affected riders.</EmptyState>}
              </Section>
            </div>
          ) : null}

          {activeSection === "payoutQueue" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Pending Review" value={pendingPayoutCount} note="Claims waiting for admin action" accent="var(--admin-accent)" />
                <MetricCard label="Flagged by Fraud" value={fraudFlaggedPayouts} note="High-risk payouts in the queue" accent="var(--admin-danger)" />
                <MetricCard label="Paid This Week" value={formatCurrency(dashboard.metrics?.totalPayoutsThisWeek || 0)} note="Completed rider transfers" accent="var(--admin-success)" />
              </div>

              <Section title="Payout Queue" subtitle="Approve or reject claims with clear eligibility and fraud context." actions={<ExportButton rows={filteredQueue} filename="payout-queue.csv" label="Export Data" />}>
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <input className="rounded-2xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} placeholder="Search rider or zone" value={queueFilters.search} onChange={(event) => setQueueFilters((prev) => ({ ...prev, search: event.target.value }))} />
                  <select className="rounded-2xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} value={queueFilters.zone} onChange={(event) => setQueueFilters((prev) => ({ ...prev, zone: event.target.value }))}>
                    <option value="ALL">All Zones</option>
                    {availableZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} value={queueFilters.type} onChange={(event) => setQueueFilters((prev) => ({ ...prev, type: event.target.value }))}>
                    <option value="ALL">All Types</option>
                    {EVENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text)" }} value={queueFilters.status} onChange={(event) => setQueueFilters((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="ALL">All Statuses</option>
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr>
                        <th className="px-4 py-3">Rider</th>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3">Calamity</th>
                        <th className="px-4 py-3">Eligibility</th>
                        <th className="px-4 py-3">Fraud</th>
                        <th className="px-4 py-3">Payout</th>
                        <th className="px-4 py-3">Transfer</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.map((item) => (
                        <tr key={item._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-4 py-3"><p className="font-semibold">{item.riderName}</p><p className="text-xs admin-subtle">{item.city || "-"}</p></td>
                          <td className="px-4 py-3">{item.zone}</td>
                          <td className="px-4 py-3">{item.calamityType}</td>
                          <td className="px-4 py-3"><Tag>{item.eligibility}</Tag></td>
                          <td className="px-4 py-3"><Tag>{item.fraudRiskTier || "LOW"}</Tag></td>
                          <td className="px-4 py-3 font-semibold">{formatCurrency(item.payoutAmount)}</td>
                          <td className="px-4 py-3"><Tag>{item.transferStatus}</Tag></td>
                          <td className="px-4 py-3">
                            {["ADMIN_REVIEW", "HOLD_RIDER_VERIFICATION"].includes(item.decision) ? (
                              <div className="flex gap-2">
                                <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-success)", color: "#fff" }} type="button" onClick={() => reviewClaim(item._id, true)}>Approve</button>
                                <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-danger)", color: "#fff" }} type="button" onClick={() => reviewClaim(item._id, false)}>Reject</button>
                              </div>
                            ) : <span className="text-xs admin-subtle">Reviewed</span>}
                          </td>
                        </tr>
                      ))}
                      {!filteredQueue.length ? <tr><td colSpan="8" className="px-4 py-6 text-sm admin-subtle">No payouts in queue.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          ) : null}

          {activeSection === "triggerPanel" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Active Triggers" value={dashboard.activeEvents?.length || 0} note="Currently operational trigger zones" accent="var(--admin-accent)" />
                <MetricCard label="Pending Social Alerts" value={dashboard.socialTriggerPanel?.length || 0} note="Manual confirmations waiting" />
                <MetricCard label="System Status" value={dashboard.systemStatus?.label || "Monitoring"} note={dashboard.systemStatus?.note} accent="var(--admin-success)" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                <Section title="Social Trigger Panel" subtitle="Incoming social and anomaly alerts that need confirm or dismiss decisions.">
                  <div className="space-y-4">
                    {(dashboard.socialTriggerPanel || []).map((alert) => (
                      <div key={alert._id} className="rounded-3xl border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                        <div className="grid gap-5 lg:grid-cols-[1.6fr_0.8fr]">
                          <div>
                            <div className="flex items-center gap-3">
                              <Tag>{alert.status}</Tag>
                              <span className="text-xs admin-subtle">{timeAgo(alert.detectedAt)}</span>
                            </div>
                            <p className="mt-3 text-xl font-semibold">{alert.title}</p>
                            <p className="mt-2 text-sm admin-subtle">{alert.summary}</p>
                            <p className="mt-3 text-xs admin-subtle">Source: {alert.source}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] admin-subtle">Location</p>
                            <p className="mt-2 font-semibold">{alert.locationLabel}</p>
                            <p className="mt-4 text-xs uppercase tracking-[0.22em] admin-subtle">Impact Projection</p>
                            <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--admin-danger)" }}>-{alert.impactProjection?.projectedDropPercent || 0}%</p>
                            <p className="mt-1 text-sm admin-subtle">{alert.impactProjection?.affectedRiders || 0} riders impacted</p>
                            <div className="mt-5 flex gap-2">
                              <button className="flex-1 rounded-xl px-3 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={() => { setSelectedAlert(alert); decideSocialTrigger(alert._id, true); }}>Confirm</button>
                              <button className="flex-1 rounded-xl px-3 py-3 text-sm font-semibold" style={{ background: "var(--admin-surface)", color: "var(--admin-text)" }} type="button" onClick={() => decideSocialTrigger(alert._id, false)}>Dismiss</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!dashboard.socialTriggerPanel?.length ? <EmptyState>No social alerts are waiting for manual confirmation.</EmptyState> : null}
                  </div>
                </Section>

                <Section title="Alert Confirmation" subtitle="Impact map, confidence, and affected riders for the selected alert.">
                  {selectedAlert ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                        <p className="text-xs uppercase tracking-[0.22em] admin-subtle">Impact Projection</p>
                        <p className="mt-2 text-4xl font-semibold" style={{ color: "var(--admin-danger)" }}>-{selectedAlert.impactProjection?.projectedDropPercent || 0}%</p>
                        <p className="mt-1 text-sm admin-subtle">Confidence {selectedAlert.impactProjection?.confidence || dashboard.logicEngine?.confidenceScore || 0}%</p>
                      </div>
                      <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12), transparent)" }}>
                        <p className="font-semibold">{selectedAlert.title}</p>
                        <p className="mt-2 text-sm admin-subtle">{selectedAlert.locationLabel}</p>
                        <div className="mt-4 h-44 rounded-2xl" style={{ background: "radial-gradient(circle at 55% 45%, rgba(245,158,11,0.6), transparent 22%), linear-gradient(135deg, rgba(15,118,110,0.9), rgba(15,23,42,0.72))" }} />
                      </div>
                    </div>
                  ) : <EmptyState>Select an incoming alert to inspect its confirmation view.</EmptyState>}
                </Section>
              </div>

              <Section title="Manual Trigger Creation" subtitle="Keep manual event creation available for operations and demos.">
                <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={submitEvent}>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={eventForm.sourceType} onChange={(event) => setEventForm((prev) => ({ ...prev, sourceType: event.target.value }))}>
                    <option value="WEATHER">Weather</option>
                    <option value="SOCIAL">Social</option>
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={eventForm.eventType} onChange={(event) => setEventForm((prev) => ({ ...prev, eventType: event.target.value }))}>
                    {EVENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="City" value={eventForm.city} onChange={(event) => setEventForm((prev) => ({ ...prev, city: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Zone code" value={eventForm.zoneCode} onChange={(event) => setEventForm((prev) => ({ ...prev, zoneCode: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Center lat" value={eventForm.centerLat} onChange={(event) => setEventForm((prev) => ({ ...prev, centerLat: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Center lng" value={eventForm.centerLng} onChange={(event) => setEventForm((prev) => ({ ...prev, centerLng: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Radius (km)" value={eventForm.radiusKm} onChange={(event) => setEventForm((prev) => ({ ...prev, radiusKm: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Severity label" value={eventForm.severityLabel} onChange={(event) => setEventForm((prev) => ({ ...prev, severityLabel: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Severity factor" value={eventForm.severityFactor} onChange={(event) => setEventForm((prev) => ({ ...prev, severityFactor: event.target.value }))} />
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Loss hours" value={eventForm.lossHours} onChange={(event) => setEventForm((prev) => ({ ...prev, lossHours: event.target.value }))} />
                  <div className="xl:col-span-3">
                    <button className="rounded-2xl px-5 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="submit">Create Trigger</button>
                  </div>
                </form>
              </Section>
            </div>
          ) : null}

          {activeSection === "alertTimeline" ? (
            <div className="space-y-6">
              <Section title="Alert Timeline" subtitle="Track incoming trigger signals, actions, and backend outcomes.">
                <div className="space-y-3">
                  {(dashboard.recentTriggerFeed || []).map((item) => (
                    <div key={item._id} className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <Tag tone={{ color: item.color, soft: `${item.color}22` }}>{item.label}</Tag>
                            <span className="text-xs admin-subtle">{timeAgo(item.detectedAt)}</span>
                          </div>
                          <p className="mt-3 text-lg font-semibold">{item.city} / {item.zoneCode}</p>
                          <p className="mt-1 text-sm admin-subtle">{item.triggerSource} · {item.sourceType}</p>
                        </div>
                        <div className="text-right">
                          <Tag>{item.status}</Tag>
                          <p className="mt-2 text-sm admin-subtle">{item.eligibleRiders} riders eligible</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!dashboard.recentTriggerFeed?.length ? <EmptyState>No timeline activity is available yet.</EmptyState> : null}
                </div>
              </Section>

              <div className="grid gap-6 xl:grid-cols-2">
                <Section title="Complaint Review" subtitle="Keep complaint and adjustment flows available inside operations.">
                  <div className="space-y-3">
                    {(dashboard.complaints || []).map((complaint) => {
                      const riderName = complaint.riderId?.userId?.name || complaint.riderId?.userId?.email || "Unknown rider";
                      const draft = complaintReviewDrafts[complaint._id] || {};
                      const canReview = ["OPEN", "UNDER_REVIEW"].includes(complaint.status);
                      return (
                        <div key={complaint._id} className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{complaint.subject}</p>
                              <p className="mt-1 text-sm admin-subtle">{riderName} · {complaint.category?.replaceAll("_", " ")}</p>
                            </div>
                            <Tag>{complaint.status}</Tag>
                          </div>
                          <p className="mt-3 text-sm">{complaint.message}</p>
                          {complaint.resolutionNote ? <p className="mt-3 text-sm admin-subtle">Resolution: {complaint.resolutionNote}</p> : null}
                          {complaint.adjustmentAmount ? <p className="mt-2 text-sm" style={{ color: "var(--admin-success)" }}>Adjustment credited: {formatCurrency(complaint.adjustmentAmount)}</p> : null}
                          {canReview ? (
                            <div className="mt-4 space-y-2">
                              <input className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} placeholder="Resolution note" value={draft.note || ""} onChange={(event) => setComplaintReviewDrafts((current) => ({ ...current, [complaint._id]: { ...current[complaint._id], note: event.target.value } }))} />
                              {complaint.category === "WRONG_CALCULATION" ? <input className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} placeholder="Adjustment amount" value={draft.adjustmentAmount || ""} onChange={(event) => setComplaintReviewDrafts((current) => ({ ...current, [complaint._id]: { ...current[complaint._id], adjustmentAmount: event.target.value } }))} /> : null}
                              <div className="flex gap-2">
                                <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-success)", color: "#fff" }} type="button" onClick={() => reviewComplaint(complaint._id, true)}>Resolve</button>
                                <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-danger)", color: "#fff" }} type="button" onClick={() => reviewComplaint(complaint._id, false)}>Reject</button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {!dashboard.complaints?.length ? <EmptyState>No complaints available.</EmptyState> : null}
                  </div>
                </Section>

                <Section title="Appeal Review" subtitle="Appeals stay connected to the same operational timeline.">
                  <div className="space-y-3">
                    {(dashboard.appeals || []).map((appeal) => {
                      const canReview = ["OPEN", "UNDER_REVIEW"].includes(appeal.status);
                      return (
                        <div key={appeal._id} className="rounded-2xl border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{appeal.claimId?.eventId?.eventType?.replaceAll("_", " ") || "Appeal"}</p>
                              <p className="mt-1 text-sm admin-subtle">{appeal.reason}</p>
                            </div>
                            <Tag>{appeal.status}</Tag>
                          </div>
                          {appeal.resolutionNote ? <p className="mt-3 text-sm admin-subtle">Resolution: {appeal.resolutionNote}</p> : null}
                          {canReview ? (
                            <div className="mt-4 flex gap-2">
                              <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-success)", color: "#fff" }} type="button" onClick={() => reviewAppeal(appeal._id, true)}>Approve</button>
                              <button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-danger)", color: "#fff" }} type="button" onClick={() => reviewAppeal(appeal._id, false)}>Reject</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {!dashboard.appeals?.length ? <EmptyState>No appeals available.</EmptyState> : null}
                  </div>
                </Section>
              </div>
            </div>
          ) : null}

          {activeSection === "dataSources" ? (
            <Section title="Data Source Health" subtitle="Real-time status of weather, platform, and news ingestion hooks.">
              <div className="grid gap-4 xl:grid-cols-3">
                {(dashboard.dataSourceHealth || []).map((source) => (
                  <div key={source.key} className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xl font-semibold">{source.label}</p>
                      <Tag>{source.status}</Tag>
                    </div>
                    <p className="mt-3 text-sm admin-subtle">{source.note}</p>
                    <div className="mt-5 space-y-2 text-sm">
                      <p>Latency: {source.latencyMs ? `${source.latencyMs} ms` : "Unavailable"}</p>
                      <p>Last updated: {formatDate(source.lastUpdatedAt)}</p>
                    </div>
                    <button className="mt-6 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" disabled={testingSource === source.key} onClick={() => testDataSource(source.key)}>
                      {testingSource === source.key ? "Testing..." : "Test Data Source"}
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {activeSection === "logicEngine" ? (
            <div className="space-y-6">
              <Section title="Trigger Logic Engine" subtitle="Visual IF/THEN logic with real backend confidence and processing numbers.">
                <div className="rounded-[32px] p-6" style={{ background: "linear-gradient(135deg, #0f4bc4, #123d9b)", color: "#fff" }}>
                  <div className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
                    <div>
                      <p className="text-3xl font-semibold">Automated Trigger Logic</p>
                      <p className="mt-3 text-sm text-blue-100/85">The backend engine combines verified signals, shift telemetry, and zone overlap before any trigger becomes operational.</p>
                      <div className="mt-6 rounded-[24px] bg-black/10 p-5">
                        {(dashboard.logicEngine?.activeRules || []).map((rule) => (
                          <div key={`${rule.keyword}-${rule.text}`} className="flex items-start gap-3 py-3">
                            <span className="min-w-12 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">{rule.keyword}</span>
                            <p className="rounded-lg bg-white/10 px-3 py-2 text-sm">{rule.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-blue-100/80">Current Confidence</p>
                      <p className="mt-3 text-5xl font-semibold">{dashboard.logicEngine?.confidenceScore || 0}%</p>
                      <div className="mt-4 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-white" style={{ width: `${dashboard.logicEngine?.confidenceScore || 0}%` }} /></div>
                      <p className="mt-5 text-xs uppercase tracking-[0.22em] text-blue-100/80">Processing Time</p>
                      <p className="mt-3 text-2xl font-semibold">{dashboard.logicEngine?.processingTimeMs || 0} ms</p>
                      <p className="mt-3 text-sm text-blue-100/85">Last backend refresh {formatDate(dashboard.logicEngine?.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          ) : null}

          {activeSection === "ingestionLogs" ? (
            <Section title="Ingestion Logs" subtitle="Review raw trigger, weather, and payout ingestion logs with search and export.">
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={logFilter.source} onChange={(event) => setLogFilter((prev) => ({ ...prev, source: event.target.value }))}>
                  <option value="ALL">All Sources</option>
                  {[...new Set((dashboard.alertLog || []).map((item) => item.source))].map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Search logs" value={logFilter.search} onChange={(event) => setLogFilter((prev) => ({ ...prev, search: event.target.value }))} />
              </div>
              <div className="mb-4 flex justify-end"><ExportButton rows={filteredLogs} filename="ingestion-logs.csv" label="Export CSV" /></div>
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                <table className="w-full text-left text-sm">
                  <thead style={{ background: "var(--admin-surface-soft)" }}>
                    <tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Data Type</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((row) => (
                      <tr key={row._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                        <td className="px-4 py-3">{formatDate(row.timestamp)}</td>
                        <td className="px-4 py-3">{row.source}</td>
                        <td className="px-4 py-3">{row.dataType}</td>
                        <td className="px-4 py-3">{row.region}</td>
                        <td className="px-4 py-3"><Tag>{row.status}</Tag></td>
                        <td className="px-4 py-3">{row.actionTaken}</td>
                      </tr>
                    ))}
                    {!filteredLogs.length ? <tr><td colSpan="6" className="px-4 py-6 text-sm admin-subtle">No logs match the current filters.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {activeSection === "fraud" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label="Critical Alerts" value={(dashboard.fraudManagement?.flags || []).filter((item) => ["HIGH", "REPEAT_HIGH"].includes(item.riskTier)).length} note="High-risk anomalies needing action" accent="var(--admin-danger)" />
                <MetricCard label="Pending Review" value={dashboard.fraudManagement?.flags?.length || 0} note="Fraud signals in current scope" />
                <MetricCard label="Average Score" value={Math.round((dashboard.fraudManagement?.flags || []).reduce((sum, item) => sum + Number(item.anomalyScore || 0), 0) / Math.max(1, dashboard.fraudManagement?.flags?.length || 1))} note="Across current fraud flags" />
                <MetricCard label="Cluster Alerts" value={dashboard.fraudManagement?.clusterAlerts?.length || 0} note="Shared IP or device bursts" accent="var(--admin-accent)" />
              </div>

              <Section title="Fraud Detection" subtitle="Risk score, reasons, and claim actions in one place.">
                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr><th className="px-4 py-3">Rider</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Risk Score</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Actions</th></tr>
                    </thead>
                    <tbody>
                      {(dashboard.fraudManagement?.flags || []).map((item) => (
                        <tr key={item._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-4 py-3">{item.rider}</td>
                          <td className="px-4 py-3">{item.zone}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-3"><Tag>{item.riskTier}</Tag><span className="font-semibold">{item.anomalyScore}</span></div></td>
                          <td className="px-4 py-3">{item.reason}</td>
                          <td className="px-4 py-3">{item.claimId ? <div className="flex gap-2"><button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-success)", color: "#fff" }} type="button" onClick={() => reviewClaim(item.claimId, true)}>Approve Payout</button><button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-danger)", color: "#fff" }} type="button" onClick={() => reviewClaim(item.claimId, false)}>Reject Claim</button></div> : <span className="text-xs admin-subtle">No linked claim</span>}</td>
                        </tr>
                      ))}
                      {!dashboard.fraudManagement?.flags?.length ? <tr><td colSpan="5" className="px-4 py-6 text-sm admin-subtle">No fraud flags currently.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          ) : null}

          {activeSection === "riders" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label="Growth" value={`${dashboard.riderStats?.growthPct || 0}%`} note="30-day onboarding growth" accent="var(--admin-accent)" />
                <MetricCard label="Total Verified" value={dashboard.riderStats?.totalVerified || 0} note="KYC-verified riders" accent="var(--admin-success)" />
                <MetricCard label="Pending KYC" value={dashboard.riderStats?.pendingKyc || 0} note="Profiles needing action" accent="var(--admin-danger)" />
                <MetricCard label="Active Claims" value={dashboard.riderStats?.activeClaims || 0} note="Claims under active handling" />
              </div>

              <Section title="Registered Riders" subtitle="Search and filter riders by zone, plan, and KYC state.">
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <input className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} placeholder="Search rider or ID" value={riderFilters.search} onChange={(event) => setRiderFilters((prev) => ({ ...prev, search: event.target.value }))} />
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={riderFilters.zone} onChange={(event) => setRiderFilters((prev) => ({ ...prev, zone: event.target.value }))}>
                    <option value="ALL">All Zones</option>
                    {availableZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={riderFilters.plan} onChange={(event) => setRiderFilters((prev) => ({ ...prev, plan: event.target.value }))}>
                    <option value="ALL">All Plans</option>
                    {availablePlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                  </select>
                  <select className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }} value={riderFilters.kyc} onChange={(event) => setRiderFilters((prev) => ({ ...prev, kyc: event.target.value }))}>
                    <option value="ALL">All KYC States</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                  <table className="w-full text-left text-sm">
                    <thead style={{ background: "var(--admin-surface-soft)" }}>
                      <tr><th className="px-4 py-3">Rider Details</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">KYC Status</th><th className="px-4 py-3">Claims</th><th className="px-4 py-3">Join Date</th><th className="px-4 py-3">Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredRiders.map((item) => (
                        <tr key={item._id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-4 py-3"><p className="font-semibold">{item.name}</p><p className="text-xs admin-subtle">{item.riderIdLabel}</p></td>
                          <td className="px-4 py-3">{item.city} · {item.zone}</td>
                          <td className="px-4 py-3"><Tag>{item.plan}</Tag></td>
                          <td className="px-4 py-3"><Tag>{item.kycStatus}</Tag></td>
                          <td className="px-4 py-3">{item.claimsCount}</td>
                          <td className="px-4 py-3">{formatDate(item.joinDate)}</td>
                          <td className="px-4 py-3"><button className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={() => setSelectedRider(item)}>View</button></td>
                        </tr>
                      ))}
                      {!filteredRiders.length ? <tr><td colSpan="7" className="px-4 py-6 text-sm admin-subtle">No riders match the current filter.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          ) : null}

          {activeSection === "shifts" ? (
            <Section title="Shift Monitoring" subtitle="Track rider shift windows and anomalies alongside live events.">
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--admin-border)" }}>
                <table className="w-full text-left text-sm">
                  <thead style={{ background: "var(--admin-surface-soft)" }}>
                    <tr><th className="px-4 py-3">Rider</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Shift Active</th><th className="px-4 py-3">Shift Start</th><th className="px-4 py-3">Shift End</th><th className="px-4 py-3">Anomaly</th></tr>
                  </thead>
                  <tbody>
                    {(dashboard.shiftActivity || []).map((row) => (
                      <tr key={row.riderId} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                        <td className="px-4 py-3">{row.rider}</td>
                        <td className="px-4 py-3">{row.city || "-"}</td>
                        <td className="px-4 py-3">{row.zone}</td>
                        <td className="px-4 py-3"><Tag>{row.shiftActive ? "ACTIVE_SHIFT" : "OFF_SHIFT"}</Tag></td>
                        <td className="px-4 py-3">{formatDate(row.shiftStart)}</td>
                        <td className="px-4 py-3">{formatDate(row.shiftEnd)}</td>
                        <td className="px-4 py-3">{row.anomalyFlag ? <Tag>FLAGGED</Tag> : <span className="text-xs admin-subtle">Clear</span>}</td>
                      </tr>
                    ))}
                    {!dashboard.shiftActivity?.length ? <tr><td colSpan="7" className="px-4 py-6 text-sm admin-subtle">No shift data available.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {activeSection === "settings" ? (
            <div className="space-y-6">
              <Section title="System Settings" subtitle="Configure payout thresholds, data source visibility, and admin controls.">
                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(settingsDraft?.triggerThresholds || {}).map(([key, value]) => (
                        <div key={key} className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                          <p className="text-xs uppercase tracking-[0.22em] admin-subtle">{key}</p>
                          <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }} value={value} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, triggerThresholds: { ...prev.triggerThresholds, [key]: event.target.value } }))} />
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">Auto Approval Rules</p>
                          <p className="mt-1 text-sm admin-subtle">Enable backend-driven approval for low-risk claims.</p>
                        </div>
                        <button className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: settingsDraft?.autoApproveLowRisk ? "var(--admin-accent)" : "var(--admin-surface)", color: settingsDraft?.autoApproveLowRisk ? "#fff" : "var(--admin-text)" }} type="button" onClick={() => setSettingsDraft((prev) => ({ ...prev, autoApproveLowRisk: !prev.autoApproveLowRisk }))}>
                          {settingsDraft?.autoApproveLowRisk ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                      <p className="text-lg font-semibold">API Status</p>
                      <div className="mt-4 space-y-3">
                        {(dashboard.dataSourceHealth || []).map((source) => (
                          <div key={source.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3" style={{ background: "var(--admin-surface)" }}>
                            <div>
                              <p className="font-medium">{source.label}</p>
                              <p className="text-xs admin-subtle">{formatDate(source.lastUpdatedAt)}</p>
                            </div>
                            <Tag>{source.status}</Tag>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl p-4" style={{ background: "var(--admin-surface-soft)" }}>
                      <p className="text-lg font-semibold">Admin Roles</p>
                      <div className="mt-4 space-y-3">
                        {(dashboard.settings?.adminUsers || []).map((user) => (
                          <div key={user._id} className="rounded-xl px-3 py-3" style={{ background: "var(--admin-surface)" }}>
                            <p className="font-medium">{user.name}</p>
                            <p className="mt-1 text-sm admin-subtle">{user.email}</p>
                            <p className="mt-2 text-xs">{user.role}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button className="w-full rounded-2xl px-5 py-3 text-sm font-semibold" style={{ background: "var(--admin-accent)", color: "#fff" }} type="button" onClick={saveSettings}>
                      Save Changes
                    </button>
                  </div>
                </div>
              </Section>
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
              <p><span className="admin-subtle">Claim history:</span> {selectedRider.claimsCount} claims</p>
              <p><span className="admin-subtle">Manual flag:</span> {selectedRider.manualFlag ? "Yes" : "No"}</p>
            </div>
            <div className="mt-5 flex gap-3">
              <button className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: selectedRider.manualFlag ? "var(--admin-danger)" : "var(--admin-accent)", color: "#fff" }} type="button" onClick={() => toggleManualFlag(selectedRider, !selectedRider.manualFlag)}>
                {selectedRider.manualFlag ? "Clear Flag" : "Flag Rider"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

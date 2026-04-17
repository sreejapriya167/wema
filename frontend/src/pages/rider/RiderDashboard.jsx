import { useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { RiderHomeTab } from "./RiderHomeTab.jsx";
import { RiderPolicyTab } from "./RiderPolicyTab.jsx";
import { RiderClaimsTab } from "./RiderClaimsTab.jsx";
import { RiderPayoutsTab } from "./RiderPayoutsTab.jsx";
import { RiderProfileTabV2 } from "./RiderProfileTabV2.jsx";
import { PLAN_LOCK_MONTHS, PLAN_ORDER, readIdentityMeta, TAB_ITEMS } from "./RiderTabShared.jsx";

export default function RiderDashboard() {
  const { logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");
  const [appealForm, setAppealForm] = useState({ claimId: "", reason: "" });
  const [appealMessage, setAppealMessage] = useState("");
  const [complaintForm, setComplaintForm] = useState({
    category: "PAYMENT_DELAY",
    relatedClaimId: "",
    subject: "",
    message: ""
  });
  const [complaintMessage, setComplaintMessage] = useState("");
  const [providerSyncForm, setProviderSyncForm] = useState({
    deliveryStatus: "IDLE"
  });
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    city: "",
    zoneCode: "",
    upiId: "",
    provider: "",
    weeklyEarningsAverage: ""
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [pinLocationLoading, setPinLocationLoading] = useState(false);
  const [watchingLocation, setWatchingLocation] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [identityMeta, setIdentityMeta] = useState({ platform: "", partnerId: "", aadhaarLast4: "" });

  const loadRiderData = async () => {
    setLoading(true);
    setError("");

    try {
      const [{ data: dashboardResponse }, { data: payoutsResponse }, { data: plansResponse }] = await Promise.all([
        api.get("/rider/dashboard"),
        api.get("/rider/payouts"),
        api.get("/rider/plans")
      ]);

      const payload = dashboardResponse?.data || {};
      console.groupCollapsed("[RiderDashboard] backend payload");
      console.log("Fresh Dashboard Data:", payload);
      console.log("Active Policy Field:", payload.activePolicy);
      console.log("Rider Plan Field:", payload.rider?.plan);
      console.groupEnd();

      setDashboard(payload);
      setPayouts(Array.isArray(payoutsResponse?.data?.data) ? payoutsResponse.data.data : []);
      setPlans(Array.isArray(plansResponse?.data?.data) ? plansResponse.data.data : []);
      if (payload?.rider) {
        const rider = payload.rider;
        setProfileForm({
          name: rider.userId?.name || rider.name || "",
          phone: rider.userId?.phone || rider.phone || "",
          city: rider.city || "",
          zoneCode: rider.zoneCode || "",
          upiId: rider.upiId || "",
          provider: rider.provider || "",
          weeklyEarningsAverage: rider.weeklyEarningsAverage ?? ""
        });
        setIdentityMeta(readIdentityMeta(rider));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load rider dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiderData();
  }, []);

  const handlePlanChange = async (plan) => {
    setSavingPlan(plan);
    setError("");

    try {
      // Call /rider/subscribe to ACTIVATE the policy with lock-in period
      const { data } = await api.post("/rider/subscribe", {
        plan,
        autoRenew: false
      });
      const subscription = data?.data;
      if (subscription?.policy) {
        setDashboard((current) => ({
          ...(current || {}),
          rider: subscription.rider || current?.rider,
          premium: subscription.premium || current?.premium,
          aiPremiumInsight: subscription.aiPremiumInsight || current?.aiPremiumInsight,
          activePolicy: subscription.policy,
          premiumPayments: subscription.premiumPayment
            ? [subscription.premiumPayment, ...(current?.premiumPayments || [])]
            : current?.premiumPayments || []
        }));
      }
      // Reload dashboard to show activated policy
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to activate plan.");
    } finally {
      setSavingPlan("");
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    setError("");
    setAppealMessage("");
    setComplaintMessage("");

    try {
      const { data } = await api.post("/rider/subscribe", {
        plan: currentPlan,
        autoRenew: false
      });
      const subscription = data?.data;
      if (subscription?.policy) {
        setDashboard((current) => ({
          ...(current || {}),
          rider: subscription.rider || current?.rider,
          premium: subscription.premium || current?.premium,
          aiPremiumInsight: subscription.aiPremiumInsight || current?.aiPremiumInsight,
          activePolicy: subscription.policy,
          premiumPayments: subscription.premiumPayment
            ? [subscription.premiumPayment, ...(current?.premiumPayments || [])]
            : current?.premiumPayments || []
        }));
      }
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to activate policy.");
    } finally {
      setSubscribing(false);
    }
  };

  const handleProviderSync = async (event) => {
    event.preventDefault();
    setError("");
    setAppealMessage("");
    setComplaintMessage("");
    setLocationMessage("");

    try {
      await api.post("/rider/provider-sync", providerSyncForm);
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to sync provider status.");
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setError("");
    setProfileMessage("");
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/rider/profile", {
        ...profileForm,
        weeklyEarningsAverage: profileForm.weeklyEarningsAverage === "" ? undefined : Number(profileForm.weeklyEarningsAverage)
      });
      const updatedRider = data?.data?.rider;
      if (updatedRider) {
        const premiumQuoteResponse = await api.post("/rider/premium", {
          plan: updatedRider.plan,
          city: updatedRider.city,
          zoneCode: updatedRider.zoneCode,
          weeklyEarningsAverage: updatedRider.weeklyEarningsAverage
        });
        const premiumQuote = premiumQuoteResponse?.data?.data;

        setDashboard((current) => ({
          ...current,
          rider: updatedRider,
          premium: premiumQuote?.premium || current?.premium,
          aiPremiumInsight: premiumQuote?.aiPremiumInsight || current?.aiPremiumInsight
        }));
        setProfileForm({
          name: updatedRider.userId?.name || updatedRider.name || "",
          phone: updatedRider.userId?.phone || updatedRider.phone || "",
          city: updatedRider.city || "",
          zoneCode: updatedRider.zoneCode || "",
          upiId: updatedRider.upiId || "",
          provider: updatedRider.provider || "",
          weeklyEarningsAverage: updatedRider.weeklyEarningsAverage ?? ""
        });
      }
      setProfileMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAppealSubmit = async (event) => {
    event.preventDefault();
    setAppealMessage("");
    setComplaintMessage("");
    setError("");

    try {
      await api.post("/rider/appeals", appealForm);
      setAppealMessage("Appeal submitted for manual review.");
      setAppealForm({ claimId: "", reason: "" });
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to submit appeal.");
    }
  };

  const handleComplaintSubmit = async (event) => {
    event.preventDefault();
    setComplaintMessage("");
    setAppealMessage("");
    setError("");

    try {
      await api.post("/rider/complaints", complaintForm);
      setComplaintMessage("Complaint submitted successfully.");
      setComplaintForm({
        category: "PAYMENT_DELAY",
        relatedClaimId: "",
        subject: "",
        message: ""
      });
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to submit complaint.");
    }
  };

  const pushCurrentLocation = async (position) => {
    await api.post("/rider/location", {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    });
    await loadRiderData();
  };

  const handleUseMyLocation = () => {
    setError("");
    setLocationMessage("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await pushCurrentLocation(position);
          setLocationMessage("Current GPS updated from this device.");
        } catch (requestError) {
          setError(requestError?.response?.data?.message || "Unable to update current GPS.");
        } finally {
          setLocationLoading(false);
        }
      },
      (geoError) => {
        setError(geoError.message || "Unable to access device location.");
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const toggleLiveLocation = () => {
    setError("");
    setLocationMessage("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    if (watchingLocation && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchingLocation(false);
      setWatchId(null);
      setLocationMessage("Live GPS tracking stopped.");
      return;
    }

    const nextWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await pushCurrentLocation(position);
          setLocationMessage("Live GPS tracking is active.");
        } catch (requestError) {
          setError(requestError?.response?.data?.message || "Unable to sync live GPS.");
        }
      },
      (geoError) => {
        setError(geoError.message || "Unable to start live GPS tracking.");
        setWatchingLocation(false);
        setWatchId(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    setWatchId(nextWatchId);
    setWatchingLocation(true);
  };

  const handleUsePinLocation = async () => {
    setError("");
    setLocationMessage("");
    setPinLocationLoading(true);
    try {
      await api.post("/rider/pin-location");
      setLocationMessage("GPS updated to PIN location for eligibility checks.");
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to use PIN location.");
    } finally {
      setPinLocationLoading(false);
    }
  };

  const handleShiftToggle = async () => {
    const nextStatus = isShiftActive ? "IDLE" : "ACTIVE";
    setProviderSyncForm({ deliveryStatus: nextStatus });
    setError("");
    setLocationMessage("");

    if (!/^\d{6}$/.test(String(profileForm.zoneCode || "").trim())) {
      setActiveTab("profile");
      setError("Please update your zone code in Profile using a valid 6-digit PIN before starting your shift.");
      return;
    }

    try {
      if (!isShiftActive && navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                await pushCurrentLocation(position);
              } catch {
                // Keep shift updates working even if location refresh fails.
              } finally {
                resolve();
              }
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        });
      }

      await api.post("/rider/provider-sync", { deliveryStatus: nextStatus });

      if (!isShiftActive && !watchingLocation) {
        toggleLiveLocation();
      }
      if (isShiftActive && watchingLocation && watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        setWatchingLocation(false);
        setWatchId(null);
      }

      setLocationMessage(nextStatus === "ACTIVE" ? "Your shift is active now." : "Your shift has ended.");
      await loadRiderData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update shift status.");
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const currentPlan = dashboard?.rider?.plan;
  const claims = dashboard?.recentClaims || [];
  const activeAlerts = dashboard?.activeAlerts || [];
  const appeals = dashboard?.appeals || [];
  const complaints = dashboard?.complaints || [];
  const eligibilityStatus = dashboard?.eligibilityStatus || {};
  const appealableClaims = claims.filter((claim) =>
    ["REJECTED", "HOLD_RIDER_VERIFICATION"].includes(claim.decision)
  );
  const activePolicy = dashboard?.activePolicy;
  const activePlanKey = activePolicy?.planKey || null;
  const premiumPayments = dashboard?.premiumPayments || [];
  const aiPremiumInsight = dashboard?.aiPremiumInsight || null;
  const activeDeliveryStatus = dashboard?.rider?.activeDelivery?.status || "IDLE";
  const isShiftActive = ["ACTIVE", "PICKED_UP"].includes(activeDeliveryStatus);
  const coveredToday = eligibilityStatus.coveredToday ? "YES" : "NO";
  const zoneLabel = dashboard?.rider?.zoneCode || "Not set";
  const matchingAlert = activeAlerts[0];
  const coverageExplanation = eligibilityStatus.coveredToday && matchingAlert
    ? `You are covered due to ${matchingAlert.eventType.replaceAll("_", " ").toLowerCase()} in your area.`
    : "No verified weather or disruption alert is affecting your area right now.";
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const policyCards = useMemo(
    () =>
      plans.map((plan) => {
        const lockMonths = PLAN_LOCK_MONTHS[plan.key] || 0;
        const isCurrent = plan.key === activePlanKey;
        const planIndex = PLAN_ORDER.indexOf(plan.key);
        const isDowngrade = planIndex < currentPlanIndex;
        const startedAt = activePolicy?.coverageStart ? new Date(activePolicy.coverageStart) : new Date();
        const monthsElapsed = Math.max(
          0,
          (new Date().getFullYear() - startedAt.getFullYear()) * 12 + (new Date().getMonth() - startedAt.getMonth())
        );

        return {
          ...plan,
          isCurrent,
          remainingMonths: Math.max(1, lockMonths - monthsElapsed),
          locked: !isCurrent && isDowngrade,
          accent:
            plan.key === "BASIC"
              ? "#64748B"
              : plan.key === "STANDARD"
                ? "#2563EB"
                : plan.key === "PRO"
                  ? "#3B82F6"
                  : "#22C55E"
        };
      }),
    [plans, activePlanKey, currentPlanIndex, activePolicy?.coverageStart]
  );

  if (loading) {
    return (
      <div className="glass-strong ui-subtext rounded-[2rem] p-10 text-center shadow-panel">
        Loading rider dashboard...
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="glass-strong ui-status-error rounded-[2rem] p-10 text-center shadow-panel">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-[1rem] p-3 shadow-panel">
        <div className="flex flex-wrap gap-2">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.key ? "ui-primary-button" : "ui-secondary-button"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "home" ? (
        <RiderHomeTab
          activeAlerts={activeAlerts}
          currentPlan={currentPlan}
          premium={dashboard?.premium}
          coveredToday={coveredToday}
          zoneLabel={zoneLabel}
          isShiftActive={isShiftActive}
          handleShiftToggle={handleShiftToggle}
          locationLoading={locationLoading}
          locationMessage={locationMessage}
          error={error}
          coverageExplanation={coverageExplanation}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          handleProfileSave={handleProfileSave}
          savingProfile={savingProfile}
          profileMessage={profileMessage}
          activePolicy={activePolicy}
          city={dashboard?.rider?.city}
          aiPremiumInsight={aiPremiumInsight}
        />
      ) : null}

      {activeTab === "policy" ? (
        <RiderPolicyTab
          currentPlan={currentPlan}
          activePolicy={activePolicy}
          subscribing={subscribing}
          handleSubscribe={handleSubscribe}
          policyCards={policyCards}
          savingPlan={savingPlan}
          handlePlanChange={handlePlanChange}
          onPaymentSuccess={loadRiderData}
          error={error}
        />
      ) : null}

      {activeTab === "claims" ? (
        <RiderClaimsTab
          claims={claims}
          appealableClaims={appealableClaims}
          appealForm={appealForm}
          setAppealForm={setAppealForm}
          handleAppealSubmit={handleAppealSubmit}
          appealMessage={appealMessage}
          complaintForm={complaintForm}
          setComplaintForm={setComplaintForm}
          handleComplaintSubmit={handleComplaintSubmit}
          complaintMessage={complaintMessage}
          complaints={complaints}
          appeals={appeals}
          claimsForComplaint={claims}
          premiumPayments={premiumPayments}
          error={error}
        />
      ) : null}

      {activeTab === "payouts" ? <RiderPayoutsTab payouts={payouts} premiumPayments={premiumPayments} /> : null}

      {activeTab === "profile" ? (
        <RiderProfileTabV2
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          identityMeta={identityMeta}
          profileMessage={profileMessage}
          error={error}
          handleProfileSave={handleProfileSave}
          savingProfile={savingProfile}
          logout={logout}
        />
      ) : null}
    </div>
  );
}

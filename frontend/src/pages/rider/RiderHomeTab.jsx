import { Panel } from "../../components/ui/Panel.jsx";
import { EmptyState, formatCurrency, formatPremiumDueDate, statusTone } from "./RiderTabShared.jsx";

export function RiderHomeTab({
  activeAlerts,
  currentPlan,
  premium,
  aiPremiumInsight,
  coveredToday,
  zoneLabel,
  isShiftActive,
  handleShiftToggle,
  locationLoading,
  locationMessage,
  error,
  coverageExplanation,
  profileForm,
  setProfileForm,
  handleProfileSave,
  savingProfile,
  profileMessage,
  activePolicy,
  city
}) {
  const nextPremiumLabel = `${formatCurrency(premium?.recommendedPremium ?? 0)} deducted on ${formatPremiumDueDate(activePolicy?.nextRenewalAt)}`;

  return (
    <div className="space-y-5">
      {activeAlerts.length ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Calamity Alert</p>
          <p className="mt-2 text-base font-semibold text-amber-100">
            {activeAlerts[0].eventType.replaceAll("_", " ")} reported for zone {activeAlerts[0].zoneCode}
          </p>
          <p className="mt-1 text-sm text-amber-200/85">Stay safe. Your coverage is being checked automatically for your saved delivery zone in {city || activeAlerts[0].city}.</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Current plan</p><p className="ui-important mt-2 text-2xl font-semibold">{currentPlan}</p></div>
        <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Weekly premium</p><p className="ui-important mt-2 text-2xl font-semibold">{formatCurrency(premium?.recommendedPremium ?? 0)}</p></div>
        <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Coverage status</p><p className={`mt-2 text-2xl font-semibold ${statusTone(coveredToday)}`}>{coveredToday}</p></div>
        <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Zone</p><p className="ui-important mt-2 text-2xl font-semibold">{zoneLabel}</p></div>
      </div>

      <Panel title="Shift Control" subtitle="Start your shift when you begin deliveries so coverage checks use your active work status.">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-lg font-semibold ${isShiftActive ? "ui-status-active" : "ui-subtext"}`}>
              {isShiftActive ? "Your shift is active" : "You are not on an active shift"}
            </p>
            <p className="ui-subtext mt-1 text-sm">{locationMessage || "Turn this on when you begin deliveries and off when you finish."}</p>
          </div>
          <button className="ui-primary-button rounded-xl px-8 py-4 text-base font-semibold disabled:opacity-60" type="button" onClick={handleShiftToggle} disabled={locationLoading}>
            {locationLoading ? "Updating..." : isShiftActive ? "End Shift" : "Start Shift"}
          </button>
        </div>
        {error ? <p className="ui-status-error mt-4 text-sm">{error}</p> : null}
      </Panel>

      <Panel title="Coverage Update" subtitle="When an alert affects your area, this shows whether your current plan covers it, how the app checks your plan and active alerts, and why it matters for knowing your protection right now.">
        <div className="ui-card-block rounded-xl p-4"><p className={`text-base font-medium ${statusTone(coveredToday)}`}>{coverageExplanation}</p></div>
      </Panel>

      <Panel title="Weekly Earnings" subtitle="Update this when your income changes, because the app uses it to calculate a fair premium, and it is useful for keeping your recommended payment accurate.">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleProfileSave}>
          <input className="ui-input flex-1 rounded-xl px-4 py-3 outline-none" placeholder="Enter weekly earnings average" value={profileForm.weeklyEarningsAverage} onChange={(event) => setProfileForm((current) => ({ ...current, weeklyEarningsAverage: event.target.value }))} />
          <button className="ui-primary-button rounded-xl px-5 py-3 font-semibold disabled:opacity-60" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Update earnings"}</button>
        </form>
        {profileMessage ? <p className="ui-status-active mt-3 text-sm">{profileMessage}</p> : null}
      </Panel>

      <Panel title="Next Premium" subtitle="Check this before the weekly deduction happens, because it combines your plan, saved earnings, season, and risk signals, and it is useful for knowing what will be charged next.">
        <div className="ui-card-block rounded-xl p-4"><p className="ui-important text-lg font-semibold">Next {nextPremiumLabel}</p></div>
      </Panel>

      <Panel title="Why This Premium" subtitle="See the exact factors that shaped your weekly premium so the pricing feels transparent and fair.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Base premium</p><p className="ui-important mt-2 text-lg font-semibold">{formatCurrency(premium?.basePremium ?? 0)}</p></div>
          <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Zone risk score</p><p className="ui-important mt-2 text-lg font-semibold">{Number(premium?.zoneRiskScore ?? 0).toFixed(2)}</p></div>
          <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Risk multiplier</p><p className="ui-important mt-2 text-lg font-semibold">{Number(premium?.riskMultiplier ?? 1).toFixed(2)}x</p></div>
          <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Season factor</p><p className="ui-important mt-2 text-lg font-semibold">{premium?.season || "-"}</p><p className="ui-subtext mt-1 text-xs">{Number(premium?.seasonMultiplier ?? 1).toFixed(2)}x</p></div>
          <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Income cap</p><p className="ui-important mt-2 text-lg font-semibold">{formatCurrency(premium?.premiumCap ?? 0)}</p></div>
        </div>
        <div className="ui-card-block mt-4 rounded-xl p-4">
          <p className="ui-important text-base font-semibold">Final weekly premium: {formatCurrency(premium?.recommendedPremium ?? 0)}</p>
          <p className="ui-subtext mt-2 text-sm">
            Raw premium comes to {formatCurrency(premium?.rawPremium ?? 0)}.
            {premium?.cappedByIncome ? " Your weekly income cap reduced it to keep the charge rider-friendly." : " Your premium is still within the weekly income cap."}
          </p>
        </div>
      </Panel>

      <Panel title="AI Premium Insight" subtitle="This summary is generated on the backend using your pricing inputs, while the AI API key stays on the server only.">
        <div className="ui-card-block rounded-xl p-4">
          {aiPremiumInsight ? (
            <>
              <p className="ui-important text-base font-semibold">{aiPremiumInsight.summary}</p>
              <p className="ui-subtext mt-2 text-sm">{aiPremiumInsight.recommendation}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(aiPremiumInsight.factors || []).map((factor) => (
                  <span key={factor} className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                    {factor}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="ui-subtext text-sm">
              AI premium insight is unavailable right now. Set <code>AI_API_KEY</code> on the backend to enable
              automatic pricing commentary.
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Live Alerts" subtitle="Use this whenever weather or disruption conditions may affect your route, because verified alerts appear here automatically, and it helps you stay informed before you head out.">
        <div className="space-y-3">
          {activeAlerts.length ? activeAlerts.map((alert) => (
            <div key={alert._id} className="ui-card-block rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="ui-important font-semibold">{alert.eventType.replaceAll("_", " ")}</p>
                  <p className="ui-subtext mt-1 text-sm">{alert.city} · Zone {alert.zoneCode}</p>
                </div>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">{alert.severity.label}</span>
              </div>
            </div>
          )) : <EmptyState>No active alerts for your area right now.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

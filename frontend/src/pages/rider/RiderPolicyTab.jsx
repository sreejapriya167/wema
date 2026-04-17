import { useState } from "react";
import { Panel } from "../../components/ui/Panel.jsx";
import PolicyTermsModal from "../../components/PolicyTermsModal.jsx";
import PaymentModal from "../../components/PaymentModal.jsx";
import { formatCurrency, formatDate } from "./RiderTabShared.jsx";

const PLAN_DETAILS = {
  BASIC: {
    weekly: 39,
    maxPayout: 300,
    coverage: ["BANDH", "CURFEW", "STRIKE", "ZONE CLOSURE", "SOCIAL DISRUPTION"]
  },
  STANDARD: {
    weekly: 59,
    maxPayout: 600,
    coverage: ["HEAVY RAIN", "FLOOD", "EXTREME HEAT", "SEVERE POLLUTION"]
  },
  PRO: {
    weekly: 99,
    maxPayout: 1200,
    coverage: ["HEAVY RAIN", "FLOOD", "EXTREME HEAT", "SEVERE POLLUTION", "BANDH", "CURFEW", "STRIKE", "ZONE CLOSURE", "SOCIAL DISRUPTION"]
  },
  PREMIUM: {
    weekly: 159,
    maxPayout: 2000,
    coverage: ["HEAVY RAIN", "FLOOD", "EXTREME HEAT", "SEVERE POLLUTION", "BANDH", "CURFEW", "STRIKE", "ZONE CLOSURE", "SOCIAL DISRUPTION", "EARTHQUAKE", "CYCLONE"]
  }
};

export function RiderPolicyTab({
  currentPlan,
  activePolicy,
  subscribing,
  handleSubscribe,
  policyCards,
  savingPlan,
  handlePlanChange,
  error,
  onPaymentSuccess
}) {
  const [termsModalPlan, setTermsModalPlan] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null); // { policyId: string } or null
  const hasPendingPlanSelection = !activePolicy && Boolean(currentPlan);

  const handlePlanCardClick = (planKey) => {
    // Show terms modal instead of directly changing plan
    setTermsModalPlan(planKey);
  };

  const handleAcceptTerms = (planKey) => {
    // Close modal and proceed with plan change
    setTermsModalPlan(null);
    handlePlanChange(planKey);
  };

  // Calculate days remaining in lock-in
  const getDaysRemaining = () => {
    if (!activePolicy?.lockInExpiryAt) return 0;
    const now = new Date();
    const expiry = new Date(activePolicy.lockInExpiryAt);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const daysRemaining = getDaysRemaining();
  const planDetails = activePolicy ? PLAN_DETAILS[activePolicy.planKey] : null;
  const pendingPlanDetails = hasPendingPlanSelection ? PLAN_DETAILS[currentPlan] : null;

  return (
    <div className="space-y-5">
      <Panel title="Your Policy" subtitle="Choose the plan that matches how much protection you want.">
        <div className="ui-card-block rounded-xl p-4">
          {activePolicy ? (
            <>
              <p className="ui-subtext text-sm">Current coverage</p>
              <p className="ui-important mt-2 text-2xl font-semibold">{activePolicy.planKey}</p>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="ui-subtext text-xs">Weekly Premium</p>
                  <p className="ui-important text-xl font-semibold">{formatCurrency(planDetails?.weekly)}/week</p>
                </div>
                <div>
                  <p className="ui-subtext text-xs">Weekly Max Payout</p>
                  <p className="ui-important text-xl font-semibold">{formatCurrency(planDetails?.maxPayout)}</p>
                </div>
                <div>
                  <p className="ui-subtext text-xs">Coverage</p>
                  <p className="ui-subtext text-sm">{planDetails?.coverage.join(", ")}</p>
                </div>
                <div className="pt-2">
                  <p className="ui-subtext text-xs">Status</p>
                  <p className="ui-important text-sm">
                    ✅ Active - {daysRemaining === 0 ? "Can change plan now" : `${daysRemaining} days until change allowed`}
                  </p>
                </div>
                <div className="pt-2">
                  <p className="ui-subtext text-xs">Next Renewal</p>
                  <p className="ui-important text-sm">
                    {activePolicy?.nextRenewalAt ? formatDate(activePolicy.nextRenewalAt) : "Not set"}
                  </p>
                </div>
                {daysRemaining > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-xs text-blue-300">
                      🔒 Lock-in period: Cannot change plan for {daysRemaining} more days
                    </p>
                  </div>
                )}
                <div className="mt-4">
                  <button
                    className="ui-primary-button rounded-xl px-5 py-3 font-semibold disabled:opacity-60"
                    type="button"
                    onClick={() => setPaymentModal({ policyId: activePolicy._id })}
                    disabled={activePolicy?.isPaid || !activePolicy?._id}
                  >
                    {activePolicy?.isPaid ? "✓ Premium Paid" : "Pay One-Time Premium"}
                  </button>
                </div>
              </div>
            </>
          ) : hasPendingPlanSelection ? (
            <>
              <p className="ui-subtext text-sm">Current coverage</p>
              <p className="ui-important mt-2 text-2xl font-semibold">{currentPlan} selected (not activated)</p>
              <p className="ui-subtext mt-2 text-sm">Your profile plan is saved, but policy activation is pending. Activate once to enable protection for the lock-in period.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="ui-subtext text-xs">Weekly Premium</p>
                  <p className="ui-important text-xl font-semibold">{formatCurrency(pendingPlanDetails?.weekly || 0)}/week</p>
                </div>
                <div>
                  <p className="ui-subtext text-xs">Weekly Max Payout</p>
                  <p className="ui-important text-xl font-semibold">{formatCurrency(pendingPlanDetails?.maxPayout || 0)}</p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  className="ui-primary-button rounded-xl px-5 py-3 font-semibold disabled:opacity-60"
                  type="button"
                  onClick={() => handlePlanCardClick(currentPlan)}
                  disabled={subscribing || savingPlan === currentPlan}
                >
                  {subscribing || savingPlan === currentPlan ? "Activating..." : `Activate ${currentPlan}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="ui-subtext text-sm">Current coverage</p>
              <p className="ui-important mt-2 text-2xl font-semibold">No Plan Selected</p>
              <p className="ui-subtext mt-2 text-sm">Select a plan from below to get started with income protection.</p>
              <div className="mt-4">
                <button
                  className="ui-primary-button rounded-xl px-5 py-3 font-semibold disabled:opacity-60"
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                >
                  {subscribing ? "Updating..." : "View Plans"}
                </button>
              </div>
            </>
          )}
          {error ? <p className="ui-status-error mt-4 text-sm">{error}</p> : null}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {policyCards.map((plan) => (
          <button
            key={plan.key}
            type="button"
            onClick={() => !plan.isCurrent && !plan.locked && handlePlanCardClick(plan.key)}
            disabled={savingPlan === plan.key || plan.locked}
            className="rounded-xl border p-5 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-70 hover:border-opacity-70"
            style={{
              background: "#0B1120",
              borderColor: plan.isCurrent ? plan.accent : "#1E293B"
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-important text-lg font-semibold">{plan.key}</p>
                <p className="ui-subtext mt-1 text-sm">{formatCurrency(plan.weeklyPremiumBase)}/week</p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: `${plan.accent}1F`,
                  color: plan.accent
                }}
              >
                {plan.isCurrent
                  ? `Active - ${plan.remainingMonths} months remaining`
                  : plan.locked
                    ? "🔒 Locked"
                    : "Select Plan"}
              </span>
            </div>
            <p className="ui-subtext mt-4 text-sm">Weekly max payout: {formatCurrency(plan.weeklyPayoutCap)}</p>
            <p className="ui-subtext mt-2 text-sm">
              Covers: {plan.calamityTypes.map((type) => type.replaceAll("_", " ")).join(", ")}
            </p>
            {!plan.isCurrent && savingPlan === plan.key ? (
              <p className="ui-subtext mt-3 text-xs">Activating plan...</p>
            ) : null}
            {!plan.isCurrent && !plan.locked && (
              <button
                className="ui-primary-button mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlanCardClick(plan.key);
                }}
              >
                View Details & Activate
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Terms & Conditions Modal */}
      {termsModalPlan && (
        <PolicyTermsModal
          plan={termsModalPlan}
          onClose={() => setTermsModalPlan(null)}
          onAccept={handleAcceptTerms}
        />
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          policyId={paymentModal.policyId}
          onClose={() => setPaymentModal(null)}
          onSuccess={(paymentData) => {
            setPaymentModal(null);
            onPaymentSuccess && onPaymentSuccess(paymentData);
          }}
        />
      )}
    </div>
  );
}

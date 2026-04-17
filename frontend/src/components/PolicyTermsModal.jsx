import { useState } from "react";

const PLAN_TERMS = {
  BASIC: {
    name: "BASIC",
    weekly: "₹39",
    maxPayout: "₹300",
    lockIn: "2 months",
    description: "Essential income protection for social disruptions",
    coverage: [
      "BANDH (Closure/Strike)",
      "CURFEW (Imposed restrictions)",
      "STRIKE (Labor/Political protests)",
      "ZONE CLOSURE (Area blockade)",
      "SOCIAL DISRUPTION (Riots/Unrest)"
    ],
    terms: [
      "This Basic Plan provides income protection specifically designed for delivery riders affected by social disruptions.",
      "Coverage Period: 7 days per week, but calamity must occur on designated income days to qualify.",
      "Maximum Weekly Payout: ₹300 per event in the coverage zone.",
      "Claim Processing: 48-72 hours after incident verification.",
      "Lock-in Period: 2 months from activation. You cannot change or downgrade this plan during this period.",
      "Automatic Renewal: Available. No action required if auto-debit is enabled.",
      "Exclusions: Claims during active shift without GPS verification, duplicate claims within 24 hours.",
      "Cancellation: Allowed only after 2-month lock-in period expires. Refund not available for paid premiums.",
      "Premium: Non-adjustable once activated. Calculated based on zone risk and income average.",
      "Terms Review Date: Reviewed annually. WEMA reserves right to update terms with 30 days notice."
    ]
  },
  STANDARD: {
    name: "STANDARD",
    weekly: "₹59",
    maxPayout: "₹600",
    lockIn: "6 months",
    description: "Weather protection plan with better payouts",
    coverage: [
      "HEAVY RAIN (> 50mm in 24 hours)",
      "FLOOD (Waterlogging in delivery zones)",
      "EXTREME HEAT (> 43°C official alert)",
      "SEVERE POLLUTION (AQI > 400)"
    ],
    terms: [
      "The Standard Plan is designed for riders operating in weather-prone regions.",
      "Coverage Area: All delivery zones within the selected state.",
      "Maximum Weekly Payout: ₹600 per weather event per rider.",
      "Weather Triggers: Verified through OpenWeather API with WEMA admin approval.",
      "Lock-in Period: 6 months from activation. Plan changes only allowed after this period.",
      "Claim Window: 14 days to file a claim after the weather event ends.",
      "Premium Base: ₹59/week. Adjusted for zone risk (±2% multiplier) and season (monsoon +20%).",
      "Multiple Weather Events: Same rider can file multiple claims if separate weather events occur.",
      "Documentation: Rider must provide delivery proof (photos, GPS logs) for claim eligibility.",
      "Grace Period: 2 hours before event trigger considered as claim-eligible period.",
      "Policy Renewal: Auto-renewal available. Manual renewal required if auto-debit disabled.",
      "Dispute Resolution: Claims disputes escalated to WEMA admin within 7 days."
    ]
  },
  PRO: {
    name: "PRO",
    weekly: "₹99",
    maxPayout: "₹1200",
    lockIn: "9 months",
    description: "Comprehensive protection covering weather and social disruptions",
    coverage: [
      "HEAVY RAIN",
      "FLOOD",
      "EXTREME HEAT",
      "SEVERE POLLUTION",
      "BANDH",
      "CURFEW",
      "STRIKE",
      "ZONE CLOSURE",
      "SOCIAL DISRUPTION"
    ],
    terms: [
      "The Pro Plan combines comprehensive weather and social event coverage.",
      "Coverage Zones: 3 priority zones per week for maximum focus delivery areas.",
      "Maximum Weekly Payout: ₹1200 per event. Aggregate cap: ₹2400 per week.",
      "Event Coverage: Both weather (auto-verified) and social events (admin-approved).",
      "Priority Processing: Claims processed within 24-48 hours.",
      "Lock-in Period: 9 months. Downgrade to lower plans only after lock-in expiry.",
      "Claim Multiplier: Payout increases 1.1x if multiple calamities occur same day.",
      "Rider Consistency Bonus: 15% payout increase if 3+ weeks of active shifts in past 4 weeks.",
      "Weather Threshold: Heavy Rain >=50mm, Flood based on official alerts, Heat >=43°C.",
      "Social Event Approval: WEMA admin verifies news/government sources before approval.",
      "Premium Adjustment: Base ₹99/week + 8% seasonal multiplier + zone risk factor.",
      "Limit Overrides: Special claims >₹1200 require WEMA admin approval (typically <5% of claims).",
      "Dispute Escalation: Handled by dedicated claims officer within 5 days.",
      "Cancellation Post-Lockin: Allowed with 7-day notice. Refund calculated prorata."
    ]
  },
  PREMIUM: {
    name: "PREMIUM",
    weekly: "₹159",
    maxPayout: "₹2000",
    lockIn: "12 months",
    description: "Maximum protection including extreme weather and natural disasters",
    coverage: [
      "HEAVY RAIN",
      "FLOOD",
      "EXTREME HEAT",
      "SEVERE POLLUTION",
      "BANDH",
      "CURFEW",
      "STRIKE",
      "ZONE CLOSURE",
      "SOCIAL DISRUPTION",
      "EARTHQUAKE (≥ 4.5 magnitude)",
      "CYCLONE (≥ 1 hour wind >50 kmph)"
    ],
    terms: [
      "The Premium Plan offers the ultimate protection for professional delivery riders.",
      "Annual Commitment: 12-month lock-in period. Covers all calamity types.",
      "Maximum Weekly Payout: ₹2000 per event. Aggregate monthly cap: ₹8000.",
      "Natural Disaster Coverage: Earthquake (≥4.5 mag, USGS verified) and Cyclone (≥1 hr sustained wind).",
      "Extended Claim Period: 30 days to file claims after event end date.",
      "Priority Support: Dedicated claims phone line Mon-Fri 9am-6pm.",
      "Lock-in Commitment: 12 months. Guaranteed coverage renewability post-expiry for 3 years.",
      "Consistency Reward: Bonus +25% payout if 5+ weeks active shifts per month (avg).",
      "Frequent Payout Rider: If >3 claims/month, max payout increases to ₹2500 for that month.",
      "Zone Multiplier: Operating in 2+ cities = 1.2x payout multiplier.",
      "Fraud Protection: Anti-fraud scoring. Flagged cases reviewed by independent committee.",
      "Premium Calculation: Base ₹159/week; adjustments: seasonal (+20% monsoon), zone risk (±15%), consistency bonus (+25%).",
      "Annual Review: WEMA conducts annual policy review. Renewal guaranteed unless fraud detected.",
      "Cancellation Terms: Not allowed during 12-month lock-in. Post-expiry, 30-day notice required.",
      "Claim Speed: 95% claims resolved within 48 hours of documentation submission.",
      "Lifetime Value: Loyalty benefits track - 3-year policyholders eligible for premium upgrades."
    ]
  }
};

export default function PolicyTermsModal({ plan, onClose, onAccept }) {
  const [accepted, setAccepted] = useState(false);
  const terms = PLAN_TERMS[plan];

  if (!terms) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: "var(--rider-bg, #0f0f23)",
          borderRadius: "16px",
          maxHeight: "90vh",
          width: "95%",
          maxWidth: "700px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              {terms.name} Plan
            </h2>
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "14px",
                color: "rgba(255,255,255,0.6)"
              }}
            >
              {terms.description}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: "24px",
              cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick Info */}
        <div
          style={{
            padding: "20px 24px",
            background: "rgba(59,130,246,0.1)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "16px",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase"
              }}
            >
              Weekly
            </p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              {terms.weekly}
            </p>
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase"
              }}
            >
              Max Payout
            </p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              {terms.maxPayout}
            </p>
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase"
              }}
            >
              Lock-in
            </p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              {terms.lockIn}
            </p>
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase"
              }}
            >
              Events Covered
            </p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "18px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              {terms.coverage.length}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Coverage */}
          <div style={{ marginBottom: "24px" }}>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "16px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              What's Covered
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {terms.coverage.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(59,130,246,0.15)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#fff"
                  }}
                >
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "16px",
                fontWeight: "600",
                color: "#fff"
              }}
            >
              Terms & Conditions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {terms.terms.map((term, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "rgba(255,255,255,0.8)"
                  }}
                >
                  <strong style={{ color: "#fff" }}>{idx + 1}.</strong> {term}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "20px 24px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            gap: "12px",
            flexDirection: "column"
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "14px",
              color: "rgba(255,255,255,0.8)"
            }}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            I agree to all terms and conditions. I understand the {terms.lockIn} lock-in period.
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px"
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "12px 20px",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => accepted && onAccept(plan)}
              disabled={!accepted}
              style={{
                padding: "12px 20px",
                background: accepted ? "#3B82F6" : "rgba(59,130,246,0.3)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: "600",
                cursor: accepted ? "pointer" : "not-allowed"
              }}
            >
              Activate Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

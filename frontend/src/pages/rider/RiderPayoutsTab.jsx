import { Panel } from "../../components/ui/Panel.jsx";
import { EmptyState, formatCurrency, statusTone } from "./RiderTabShared.jsx";

export function RiderPayoutsTab({ payouts, premiumPayments }) {
  return (
    <div className="space-y-5">
      <Panel title="Payout History" subtitle="Any approved payment to you will show here.">
        <div className="space-y-3">
          {payouts.length ? payouts.map((payout) => (
            <div key={payout._id} className="ui-card-block rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="ui-important font-semibold">
                    {payout.payoutType === "ADJUSTMENT"
                      ? payout.description || "Adjustment credited"
                      : payout.claimId?.eventId?.eventType?.replaceAll("_", " ") || "Claim payout"}
                  </p>
                  <p className={`mt-1 text-sm ${statusTone(payout.status)}`}>{payout.status}</p>
                </div>
                <span className="ui-important text-sm font-semibold">{formatCurrency(payout.amount)}</span>
              </div>
            </div>
          )) : <EmptyState>No payouts yet.</EmptyState>}
        </div>
      </Panel>

      <Panel title="Premium Payments" subtitle="Your weekly premium charges appear here.">
        <div className="space-y-3">
          {premiumPayments.length ? premiumPayments.map((payment) => (
            <div key={payment._id} className="ui-card-block rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="ui-important font-semibold">{payment.method.replaceAll("_", " ")}</p><p className={`mt-1 text-sm ${statusTone(payment.status)}`}>{payment.status}</p></div>
                <span className="ui-important text-sm font-semibold">{formatCurrency(payment.amount)}</span>
              </div>
            </div>
          )) : <EmptyState>No premium payments yet.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

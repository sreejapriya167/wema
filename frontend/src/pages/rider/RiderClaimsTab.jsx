import { Panel } from "../../components/ui/Panel.jsx";
import { EmptyState, formatCurrency, statusTone } from "./RiderTabShared.jsx";

export function RiderClaimsTab({
  claims,
  appealableClaims,
  appealForm,
  setAppealForm,
  handleAppealSubmit,
  appealMessage,
  complaintForm,
  setComplaintForm,
  handleComplaintSubmit,
  complaintMessage,
  complaints,
  appeals,
  claimsForComplaint,
  premiumPayments,
  error
}) {
  return (
    <div className="space-y-5">
      <Panel title="Premium Payments" subtitle="Your one-time premium payment for policy lock-in period.">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03]"><tr><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {premiumPayments && premiumPayments.length ? premiumPayments.map((payment) => (
                <tr key={payment._id}>
                  <td className="px-4 py-3">{payment.method.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(payment.amount)}</td>
                  <td className={`px-4 py-3 ${statusTone(payment.status)}`}>{payment.status}</td>
                  <td className="px-4 py-3 text-xs">{new Date(payment.paidAt).toLocaleDateString()}</td>
                </tr>
              )) : <tr><td className="ui-subtext px-4 py-4" colSpan="4">No premium payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Claims History" subtitle="Claims are created automatically when verified alerts affect your work area.">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03]"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Decision</th><th className="px-4 py-3">Payout</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {claims.length ? claims.map((claim) => (
                <tr key={claim._id}>
                  <td className="px-4 py-3">{claim.eventId.eventType.replaceAll("_", " ")}</td>
                  <td className={`px-4 py-3 ${statusTone(claim.decision)}`}>{claim.decision.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{formatCurrency(claim.cappedPayout)}</td>
                </tr>
              )) : <tr><td className="ui-subtext px-4 py-4" colSpan="3">No claims have been created yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Appeal a Claim" subtitle="If a claim needs another look, submit an appeal here.">
        <form className="space-y-3" onSubmit={handleAppealSubmit}>
          <select className="ui-input w-full rounded-xl px-4 py-3 outline-none" value={appealForm.claimId} onChange={(event) => setAppealForm((current) => ({ ...current, claimId: event.target.value }))} required disabled={!appealableClaims.length}>
            <option value="">{appealableClaims.length ? "Choose a claim to appeal" : "No claim is eligible for appeal yet"}</option>
            {appealableClaims.map((claim) => <option key={claim._id} value={claim._id}>{claim.eventId.eventType.replaceAll("_", " ")} - {claim.decision}</option>)}
          </select>
          <textarea className="ui-input min-h-28 w-full rounded-xl px-4 py-3 outline-none" placeholder="Tell us why this claim should be reviewed again" value={appealForm.reason} onChange={(event) => setAppealForm((current) => ({ ...current, reason: event.target.value }))} required disabled={!appealableClaims.length} />
          {!appealableClaims.length ? <p className="ui-subtext text-sm">Appeals open after a claim is rejected or held for verification.</p> : null}
          {appealMessage ? <p className="ui-status-active text-sm">{appealMessage}</p> : null}
          {error ? <p className="ui-status-error text-sm">{error}</p> : null}
          <button className="ui-primary-button rounded-xl px-5 py-3 font-semibold disabled:opacity-60" type="submit" disabled={!appealableClaims.length}>Submit appeal</button>
        </form>
      </Panel>

      <Panel title="Raise a Complaint" subtitle="Tell support about payment issues, wrong calculations, or technical problems.">
        <form className="space-y-3" onSubmit={handleComplaintSubmit}>
          <select className="ui-input w-full rounded-xl px-4 py-3 outline-none" value={complaintForm.category} onChange={(event) => setComplaintForm((current) => ({ ...current, category: event.target.value, relatedClaimId: "" }))}>
            <option value="PAYMENT_DELAY">Payment delay</option><option value="WRONG_CALCULATION">Wrong calculation</option><option value="TECHNICAL_ISSUE">Technical issue</option><option value="OTHER">Other</option>
          </select>
          {complaintForm.category === "WRONG_CALCULATION" ? (
            <select className="ui-input w-full rounded-xl px-4 py-3 outline-none" value={complaintForm.relatedClaimId} onChange={(event) => setComplaintForm((current) => ({ ...current, relatedClaimId: event.target.value }))}>
              <option value="">Link a claim if this complaint is about payout calculation</option>
              {claimsForComplaint.map((claim) => (
                <option key={claim._id} value={claim._id}>
                  {claim.eventId.eventType.replaceAll("_", " ")} - {formatCurrency(claim.cappedPayout)}
                </option>
              ))}
            </select>
          ) : null}
          <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Complaint subject" value={complaintForm.subject} onChange={(event) => setComplaintForm((current) => ({ ...current, subject: event.target.value }))} required />
          <textarea className="ui-input min-h-28 w-full rounded-xl px-4 py-3 outline-none" placeholder="Describe the issue" value={complaintForm.message} onChange={(event) => setComplaintForm((current) => ({ ...current, message: event.target.value }))} required />
          {complaintMessage ? <p className="ui-status-active text-sm">{complaintMessage}</p> : null}
          {error ? <p className="ui-status-error text-sm">{error}</p> : null}
          <button className="ui-primary-button rounded-xl px-5 py-3 font-semibold" type="submit">Submit complaint</button>
        </form>
      </Panel>

      <Panel title="Complaint Updates" subtitle="Track your support requests and their latest status.">
        <div className="space-y-3">
          {complaints.length ? complaints.map((complaint) => (
            <div key={complaint._id} className="ui-card-block rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="ui-important font-semibold">{complaint.subject}</p><p className="ui-subtext mt-1 text-sm">{complaint.category.replaceAll("_", " ")}</p></div>
                <span className={`text-sm font-semibold ${statusTone(complaint.status)}`}>{complaint.status}</span>
              </div>
              {complaint.resolutionNote ? <p className="ui-subtext mt-3 text-sm">Update: {complaint.resolutionNote}</p> : null}
              {complaint.adjustmentAmount ? <p className="ui-status-active mt-2 text-sm">Adjustment credited: {formatCurrency(complaint.adjustmentAmount)}</p> : null}
            </div>
          )) : <EmptyState>No complaints raised yet.</EmptyState>}
        </div>
      </Panel>

      <Panel title="Appeal Tracking" subtitle="Follow the latest status of your submitted appeals.">
        <div className="space-y-3">
          {appeals.length ? appeals.map((appeal) => (
            <div key={appeal._id} className="ui-card-block rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="ui-important font-semibold">{appeal.claimId?._id ? `Claim ${appeal.claimId._id}` : "Appeal"}</p><p className="ui-subtext mt-1 text-sm">{appeal.reason}</p></div>
                <span className={`text-sm font-semibold ${statusTone(appeal.status)}`}>{appeal.status}</span>
              </div>
              {appeal.resolutionNote ? <p className="ui-subtext mt-3 text-sm">Update: {appeal.resolutionNote}</p> : null}
            </div>
          )) : <EmptyState>No appeals filed yet.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

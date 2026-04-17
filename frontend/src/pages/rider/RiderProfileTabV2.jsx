import { Panel } from "../../components/ui/Panel.jsx";

export function RiderProfileTabV2({ profileForm, setProfileForm, identityMeta, profileMessage, error, handleProfileSave, savingProfile, logout }) {
  return (
    <div className="space-y-5">
      <Panel title="Profile" subtitle="Update the details we use for contact, payouts, and area matching.">
        <form className="space-y-4" onSubmit={handleProfileSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Full name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Phone number" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
            <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="City" value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} />
            <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Zone code (6-digit PIN)" value={profileForm.zoneCode} onChange={(event) => setProfileForm((current) => ({ ...current, zoneCode: event.target.value }))} list="profile-zone-code-options" />
            <input className="ui-input w-full rounded-xl px-4 py-3 outline-none md:col-span-2" placeholder="UPI ID" value={profileForm.upiId} onChange={(event) => setProfileForm((current) => ({ ...current, upiId: event.target.value }))} />
          </div>

          <datalist id="profile-zone-code-options">
            <option value="500001">Hyderabad</option>
            <option value="560001">Bengaluru</option>
            <option value="600001">Chennai</option>
            <option value="520001">Vijayawada</option>
            <option value="524001">Nellore</option>
            <option value="524201">Kavali</option>
          </datalist>

          <div className="ui-card-block rounded-xl p-4">
            <p className="ui-important text-sm font-semibold">How city and zone code connect</p>
            <p className="ui-subtext mt-2 text-sm">
              Your coverage checks use both fields together. City helps group alerts, and zone code must be the 6-digit PIN for your delivery area so the backend can match live events correctly.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Platform</p><p className="ui-important mt-2 font-semibold">{identityMeta.platform || "Not set"}</p></div>
            <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Delivery Partner ID</p><p className="ui-important mt-2 font-semibold">{identityMeta.partnerId || "Not set"}</p></div>
            <div className="ui-card-block rounded-xl p-4"><p className="ui-subtext text-sm">Aadhaar last 4</p><p className="ui-important mt-2 font-semibold">{identityMeta.aadhaarLast4 ? `**** ${identityMeta.aadhaarLast4}` : "Verified on file"}</p></div>
          </div>

          {profileMessage ? <p className="ui-status-active text-sm">{profileMessage}</p> : null}
          {error ? <p className="ui-status-error text-sm">{error}</p> : null}

          <div className="flex flex-col gap-3 md:flex-row">
            <button className="ui-primary-button rounded-xl px-5 py-3 font-semibold disabled:opacity-60" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save profile"}</button>
            <button className="ui-secondary-button rounded-xl px-5 py-3 font-semibold" type="button" onClick={logout}>Logout</button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

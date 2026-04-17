import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const { login, registerRider } = useAuth();
  const [mode, setMode] = useState("SIGNUP");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    email: "",
    platform: "ZOMATO",
    partnerId: "",
    aadhaarLast4: "",
    role: "RIDER",
    city: "",
    zoneCode: "",
    upiId: "",
    aadhaarVerified: true
  });

  const isSignup = mode === "SIGNUP";
  const isRider = form.role === "RIDER";

  useEffect(() => {
    if (mode === "SIGNUP" && form.role !== "RIDER") {
      setForm((current) => ({ ...current, role: "RIDER" }));
    }
  }, [mode, form.role]);

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (isSignup) {
        await registerRider(form);
      } else {
        await login(form);
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || "Unable to authenticate right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="glass-strong rounded-[1rem] p-8 shadow-panel">
          <p className="ui-brand text-sm font-semibold uppercase tracking-[0.35em] text-blue-400">WEMA</p>
          <h2 className="ui-title mt-5 text-4xl font-bold">Weather Event Money Assurance</h2>
          <p className="ui-subtext mt-4 text-sm leading-7">Income protection for food delivery riders.</p>
          <p className="ui-subtext mt-8 max-w-xl text-base leading-7">
            A rider-first insurance dashboard for coverage, claims, payouts, and support when weather or local disruptions affect your work.
          </p>
          <div className="mt-8 rounded-xl border border-slate-800 bg-[#0B1120] p-5">
            <p className="ui-important text-lg font-semibold">Simple signup, clear protection</p>
            <p className="ui-subtext mt-2 text-sm">Create your rider account with verified rider details, then log in later using your phone number and password.</p>
          </div>
        </section>

        <section className="glass-strong rounded-[1rem] p-8 shadow-panel">
          <div className="mb-6 flex gap-3">
            {["SIGNUP", "LOGIN"].map((item) => (
              <button
                key={item}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === item ? "ui-primary-button" : "ui-secondary-button"}`}
                onClick={() => setMode(item)}
                type="button"
              >
                {item === "SIGNUP" ? "Sign Up" : "Login"}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignup ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
                  <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required />
                </div>
                <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Set password (min 6 chars)" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required minLength={6} />
                <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
                <select className="ui-input w-full rounded-xl px-4 py-3 outline-none" value={form.platform} onChange={(event) => updateField("platform", event.target.value)}>
                  <option value="ZOMATO">Platform: Zomato</option>
                  <option value="SWIGGY">Platform: Swiggy</option>
                </select>
                <input
                  className="ui-input w-full rounded-xl px-4 py-3 outline-none"
                  placeholder={`Delivery Partner ID (${form.platform === "ZOMATO" ? "starts with ZOM" : "starts with SWG"})`}
                  value={form.partnerId}
                  onChange={(event) => updateField("partnerId", event.target.value.toUpperCase())}
                  required
                />
                <input
                  className="ui-input w-full rounded-xl px-4 py-3 outline-none"
                  placeholder="Aadhaar last 4 digits only"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.aadhaarLast4}
                  onChange={(event) => updateField("aadhaarLast4", event.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="City" value={form.city} onChange={(event) => updateField("city", event.target.value)} required />
                  <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Zone code (6-digit PIN)" value={form.zoneCode} onChange={(event) => updateField("zoneCode", event.target.value)} list="zone-code-options" required />
                </div>
                <datalist id="zone-code-options">
                  <option value="500001">Hyderabad</option>
                  <option value="560001">Bengaluru</option>
                  <option value="600001">Chennai</option>
                  <option value="520001">Vijayawada</option>
                  <option value="524001">Nellore</option>
                  <option value="524201">Kavali</option>
                </datalist>
                <div className="ui-card-block rounded-xl px-4 py-3 text-sm">
                  <p className="ui-important font-medium">Zone code connection</p>
                  <p className="ui-subtext mt-1">
                    This app connects your city and zone code to live weather alerts. Enter the 6-digit PIN for your delivery area, for example `500001` for Hyderabad.
                  </p>
                </div>
                <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="UPI ID" value={form.upiId} onChange={(event) => updateField("upiId", event.target.value)} required />
                <div className="ui-card-block rounded-xl px-4 py-3 text-sm">
                  <p className="ui-important font-medium">How rider login works</p>
                  <p className="ui-subtext mt-1">
                    Rider login uses your phone number and password.
                  </p>
                </div>
              </>
            ) : (
              <>
                <select className="ui-input w-full rounded-xl px-4 py-3 outline-none" value={form.role} onChange={(event) => updateField("role", event.target.value)}>
                  <option value="RIDER">Rider login</option>
                  <option value="ADMIN">Admin login</option>
                </select>
                {form.role === "RIDER" ? (
                  <>
                    <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required />
                    <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required minLength={6} />
                    <p className="ui-subtext text-sm">Use the same phone number and password you used during signup.</p>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required />
                      <input className="ui-input w-full rounded-xl px-4 py-3 outline-none" placeholder="Admin password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
                    </div>
                  </>
                )}
              </>
            )}

            {error ? <p className="ui-status-error text-sm">{error}</p> : null}

            <button className="ui-primary-button w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-60" type="submit" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "SIGNUP" ? "Create account" : "Continue"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

import { useAuth } from "../../context/AuthContext.jsx";

export function AppShell({ children }) {
  const { session, logout } = useAuth();

  if (session?.user?.role === "ADMIN") {
    return (
      <div className="min-h-screen">
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ background: "var(--admin-surface)", borderBottom: "1px solid var(--admin-border)" }}
        >
          <div>
            <p className="text-sm uppercase tracking-[0.35em]" style={{ color: "var(--admin-text-soft)" }}>
              WEMA ADMIN
            </p>
            <p className="text-xl font-semibold" style={{ color: "var(--admin-text)" }}>
              State Ops Console
            </p>
          </div>
          <button
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--admin-accent)", color: "#fff" }}
            onClick={logout}
          >
            Logout
          </button>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 text-slate-100 md:px-8">
      <header className="glass-strong mb-6 flex flex-col gap-4 rounded-[1rem] px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="ui-brand text-sm font-semibold uppercase text-blue-400">WEMA</p>
          <h1 className="ui-title text-3xl font-bold">Weather Event Money Assurance</h1>
          <p className="ui-subtext mt-2 max-w-3xl text-sm">Income protection for food delivery riders.</p>
        </div>

        <div className="ui-card-block flex items-center gap-3 rounded-full px-4 py-3">
          {session?.user ? (
            <>
              <span className="ui-subtext text-sm">
                {session.user.name} · {session.user.role}
              </span>
              <button
                className="ui-primary-button rounded-full px-4 py-2 text-sm font-semibold"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <span className="ui-subtext text-sm">Sign in to continue</span>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

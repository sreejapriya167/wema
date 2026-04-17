import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell.jsx";
import RiderDashboard from "./pages/rider/RiderDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboardV2.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";

function HomeRouter() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="glass rounded-[2rem] p-10 text-center text-slate-300 shadow-panel">
        Loading session...
      </div>
    );
  }

  if (!session?.user) {
    return <AuthPage />;
  }

  return session.user.role === "ADMIN" ? <AdminDashboard /> : <RiderDashboard />;
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomeRouter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

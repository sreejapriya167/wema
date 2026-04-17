import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem("wema_token");
    return token ? { token, user: null } : null;
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("wema_token")));

  const finalizeSession = async (token) => {
    localStorage.setItem("wema_token", token);
    const profileResponse = await api.get("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const nextSession = {
      token,
      user: profileResponse.data.data.user,
      riderProfile: profileResponse.data.data.riderProfile
    };

    if (profileResponse.data.data.riderProfile?._id) {
      localStorage.setItem("wema_rider_id", profileResponse.data.data.riderProfile._id);
    }

    setSession(nextSession);
    return nextSession;
  };

  useEffect(() => {
    if (!session?.token) {
      localStorage.removeItem("wema_token");
      localStorage.removeItem("wema_rider_id");
      return;
    }

    localStorage.setItem("wema_token", session.token);
  }, [session]);

  useEffect(() => {
    const token = localStorage.getItem("wema_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then(({ data }) => {
        setSession({ token, user: data.data.user, riderProfile: data.data.riderProfile });
        if (data.data.riderProfile?._id) {
          localStorage.setItem("wema_rider_id", data.data.riderProfile._id);
        }
      })
      .catch(() => {
        localStorage.removeItem("wema_token");
        localStorage.removeItem("wema_rider_id");
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    if (payload.role === "RIDER") {
      const { data } = await api.post("/riders/login", {
        phone: payload.phone,
        password: payload.password
      });

      return finalizeSession(data.data.token);
    }

    const { data } = await api.post("/auth/firebase-login", {
      idToken: payload.idToken || "local-dev-token",
      profile: payload
    });

    return finalizeSession(data.data.token);
  };

  const registerRider = async (payload) => {
    const { data } = await api.post("/riders/register", payload);
    return finalizeSession(data.data.token);
  };

  const logout = () => {
    localStorage.removeItem("wema_token");
    localStorage.removeItem("wema_rider_id");
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, loading, login, registerRider, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

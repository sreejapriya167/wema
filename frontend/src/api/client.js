import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "https://ai-gig-insurance-backend.onrender.com/api/v1"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("wema_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;


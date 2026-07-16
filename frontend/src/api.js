import axios from "axios";

const API_BASE = 
  (window.VITE_API_URL && !window.VITE_API_URL.startsWith("__"))
    ? window.VITE_API_URL
    : (import.meta.env.VITE_API_URL || "http://localhost:5001/api");

export function getDeviceId() {                                 
  let id = localStorage.getItem("job_tracker_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("job_tracker_device_id", id);
  }
  return id;
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { "X-Device-Id": getDeviceId() },            
});

// Axios request interceptor to inject the Bearer auth token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("job_tracker_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth helper functions
export const register = (username, password) => {
  const deviceId = getDeviceId();
  return api.post("/auth/register", { username, password, device_id: deviceId }).then((r) => {
    if (r.data.token) {
      localStorage.setItem("job_tracker_token", r.data.token);
      localStorage.setItem("job_tracker_username", r.data.username);
    }
    return r.data;
  });
};

export const login = (username, password) => {
  const deviceId = getDeviceId();
  return api.post("/auth/login", { username, password, device_id: deviceId }).then((r) => {
    if (r.data.token) {
      localStorage.setItem("job_tracker_token", r.data.token);
      localStorage.setItem("job_tracker_username", r.data.username);
    }
    return r.data;
  });
};

export const logout = () => {
  localStorage.removeItem("job_tracker_token");
  localStorage.removeItem("job_tracker_username");
};

export const getAuthUser = () => {
  const token = localStorage.getItem("job_tracker_token");
  const username = localStorage.getItem("job_tracker_username");
  if (token && username) {
    return { token, username };
  }
  return null;
};


export const getApplications = (status) =>
  api.get("/applications", { params: status ? { status } : {} }).then((r) => r.data);

export const createApplication = (payload) =>
  api.post("/applications", payload).then((r) => r.data);

export const updateApplication = (id, payload) =>
  api.put(`/applications/${id}`, payload).then((r) => r.data);

export const deleteApplication = (id) =>
  api.delete(`/applications/${id}`).then((r) => r.data);

export const getStats = () => api.get("/stats").then((r) => r.data);

export default api;

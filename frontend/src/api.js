import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "https://job-tracker-oujc.onrender.com/api";

const api = axios.create({ baseURL: API_BASE });

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

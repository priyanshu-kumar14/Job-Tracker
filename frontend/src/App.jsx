import React, { useEffect, useState, useCallback } from "react";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  getStats,
} from "./api";

const STATUS_CHOICES = ["Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"];

const STATUS_COLORS = {
  Applied: "#3b82f6",
  Interviewing: "#f59e0b",
  Offer: "#22c55e",
  Rejected: "#ef4444",
  Withdrawn: "#6b7280",
};

const emptyForm = {
  company: "",
  role: "",
  status: "Applied",
  applied_date: new Date().toISOString().slice(0, 10),
  deadline: "",
  notes: "",
  contact_email: "",
};

export default function App() {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [apps, statData] = await Promise.all([getApplications(filter), getStats()]);
      setApplications(apps);
      setStats(statData);
    } catch (e) {
      setError("Could not reach the backend API. Is it running?");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company || !form.role) return;
    try {
      await createApplication({
        ...form,
        deadline: form.deadline || null,
      });
      setForm(emptyForm);
      loadData();
    } catch (e) {
      setError("Failed to create application.");
    }
  };

  const handleStatusChange = async (id, status) => {
    await updateApplication(id, { status });
    loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this application?")) return;
    await deleteApplication(id);
    loadData();
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Job Application Tracker</h1>
        <p style={styles.subtitle}>Track applications, deadlines, and status updates in one place.</p>
      </header>

      {stats && (
        <div style={styles.statsRow}>
          <StatCard label="Total" value={stats.total} color="#111827" />
          {STATUS_CHOICES.map((s) => (
            <StatCard key={s} label={s} value={stats.by_status[s] || 0} color={STATUS_COLORS[s]} />
          ))}
        </div>
      )}

      <div style={styles.mainGrid}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <h2 style={styles.sectionTitle}>Add Application</h2>
          <input
            style={styles.input}
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            required
          />
          <input
            style={styles.input}
            placeholder="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            required
          />
          <select
            style={styles.input}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUS_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label style={styles.label}>Applied date</label>
          <input
            type="date"
            style={styles.input}
            value={form.applied_date}
            onChange={(e) => setForm({ ...form, applied_date: e.target.value })}
          />
          <label style={styles.label}>Deadline (optional)</label>
          <input
            type="date"
            style={styles.input}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Your email (for notifications)"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <textarea
            style={{ ...styles.input, height: 70 }}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit" style={styles.button}>
            Add Application
          </button>
        </form>

        <div style={styles.listPane}>
          <div style={styles.listHeader}>
            <h2 style={styles.sectionTitle}>Applications</h2>
            <select style={styles.filter} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {loading && <div>Loading...</div>}
          {!loading && applications.length === 0 && <div>No applications yet.</div>}

          {applications.map((a) => (
            <div key={a.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div>
                  <strong>{a.role}</strong> @ {a.company}
                </div>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: STATUS_COLORS[a.status] || "#999",
                  }}
                >
                  {a.status}
                </span>
              </div>
              <div style={styles.cardMeta}>
                Applied: {a.applied_date} {a.deadline ? `· Deadline: ${a.deadline}` : ""}
              </div>
              {a.notes && <div style={styles.cardNotes}>{a.notes}</div>}
              <div style={styles.cardActions}>
                <select
                  style={styles.statusSelect}
                  value={a.status}
                  onChange={(e) => handleStatusChange(a.id, e.target.value)}
                >
                  {STATUS_CHOICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button style={styles.deleteButton} onClick={() => handleDelete(a.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderTopColor: color }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 20px",
    color: "#111827",
    background: "#f9fafb",
    minHeight: "100vh",
  },
  header: { marginBottom: 24 },
  title: { fontSize: 28, margin: 0 },
  subtitle: { color: "#6b7280", marginTop: 4 },
  statsRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 },
  statCard: {
    background: "#fff",
    borderRadius: 10,
    padding: "14px 18px",
    borderTop: "3px solid",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    minWidth: 100,
  },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 12, color: "#6b7280" },
  mainGrid: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 },
  form: {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    height: "fit-content",
  },
  sectionTitle: { fontSize: 16, marginBottom: 6 },
  label: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  input: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    padding: "10px 14px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  listPane: { display: "flex", flexDirection: "column", gap: 12 },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  filter: { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" },
  error: { color: "#b91c1c", background: "#fee2e2", padding: 10, borderRadius: 6 },
  card: {
    background: "#fff",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  badge: {
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
  },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 6 },
  cardNotes: { fontSize: 13, marginTop: 8, color: "#374151" },
  cardActions: { display: "flex", gap: 8, marginTop: 12 },
  statusSelect: { padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" },
  deleteButton: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #ef4444",
    background: "#fff",
    color: "#ef4444",
    cursor: "pointer",
  },
};
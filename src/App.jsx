import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { generatePptx } from "./generatePptx";
import { generatePdf } from "./generatePdf";

const ADMIN_EMAILS = ["arobinson@hovertechinternational.com"];

const C = {
  bg: "#f5f3f1", surface: "#ffffff", surfaceAlt: "#DEDAD9", border: "#cec9c7", borderDark: "#b8b2af",
  ink: "#2a2624", inkMid: "#4F6E77", inkLight: "#7C7270", inkFaint: "#c0bbb9",
  primary: "#4F6E77", primaryLight: "#e8eff1", secondary: "#678093", secondaryLight: "#edf0f3",
  accent: "#7C5366", accentLight: "#f3eef1",
  green: "#3a7d5c", greenLight: "#e8f4ee", red: "#9e3a3a", redLight: "#fdf0f0",
  amber: "#8a6a2a", amberLight: "#fdf6e8",
};

const METRICS = [
  { id: "matt_applied",     label: "MATT Applied",           desc: "Qualifying patients that had MATT applied" },
  { id: "wedges_applied",   label: "Wedges Applied",         desc: "Qualifying patients that had wedges applied" },
  { id: "turning_criteria", label: "Turning & Repositioning",desc: "Patients that met criteria for turning and repositioning" },
  { id: "matt_proper",      label: "MATT Applied Properly",  desc: "Patients that had MATT applied properly" },
  { id: "wedges_in_room",   label: "Wedges in Room",         desc: "Patients that had wedges in room" },
  { id: "wedge_offload",    label: "Proper Wedge Offloading",desc: "Patients properly offloaded with wedges" },
  { id: "air_supply",       label: "Air Supply in Room",     desc: "Qualifying patients that had air supply in room" },
];

const defaultForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  hospital: "", protocol_for_use: "", location: "", notes: "",
  ...Object.fromEntries(METRICS.flatMap(m => [[`${m.id}_num`, ""], [`${m.id}_den`, ""]]))
});

const pct = (n, d) => { const nv = parseFloat(n), dv = parseFloat(d); if (!dv || isNaN(nv) || isNaN(dv)) return null; return Math.round((nv / dv) * 100); };
const pctColor = (v) => { if (v === null) return C.inkLight; if (v >= 90) return C.green; if (v >= 70) return C.amber; return C.red; };
const pctBg = (v) => { if (v === null) return C.surfaceAlt; if (v >= 90) return C.greenLight; if (v >= 70) return C.amberLight; return C.redLight; };
const LINE_COLORS = ["#4F6E77", "#678093", "#7C5366", "#3a7d5c", "#8a6a2a", "#5b7fa6", "#7C7270"];

const formatTimestamp = (ts, date) => {
  if (ts) {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return date || "—";
};

// ── Login Screen ─────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    setLoading(true); setError(""); setMessage("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) setError(error.message);
      else { setMessage("Account created! Check your email to confirm, then log in."); setMode("login"); }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onLogin(data.user);
    }
    setLoading(false);
  };

  const inp = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", fontSize: 14, color: C.ink, outline: "none" };
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #e8eff1 0%, #f5f3f1 50%, #f3eef1 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/hovertech-logo.png" alt="HoverTech" style={{ height: 52, objectFit: "contain" }} />
        </div>
        <div style={{ background: C.surface, borderRadius: 16, padding: "36px", boxShadow: "0 4px 32px rgba(79,110,119,0.10)" }}>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, color: C.ink, marginBottom: 4 }}>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 28 }}>{mode === "login" ? "Sign in to CareTrack" : "Join CareTrack to start logging sessions"}</p>
          {error && <div style={{ background: C.redLight, border: `1px solid #f0c8c8`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 20 }}>⚠ {error}</div>}
          {message && <div style={{ background: C.greenLight, border: `1px solid #b8dfc9`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.green, marginBottom: 20 }}>✓ {message}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && (
              <div>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>FULL NAME</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 24, background: C.primary, border: "none", borderRadius: 8, padding: "13px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: "white", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "PLEASE WAIT..." : mode === "login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
          </button>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.inkLight }}>
            {mode === "login"
              ? <span>Don't have an account? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Sign up</button></span>
              : <span>Already have an account? <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Sign in</button></span>}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>CARETRACK · WOUND CARE COMPLIANCE</div>
      </div>
    </div>
  );
};

const MetricInput = ({ metric, num, den, onChange }) => {
  const p = pct(num, den);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: "'Libre Baskerville', serif" }}>{metric.label}</div>
        <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>{metric.desc}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 4 }}>QUALIFYING</label>
          <input type="number" min="0" value={den} onChange={e => onChange("den", e.target.value)} placeholder="0"
            style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontSize: 16, fontFamily: "'Libre Baskerville', serif", color: C.ink, outline: "none" }}
            onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
        </div>
        <div style={{ paddingTop: 18, color: C.inkFaint, fontSize: 18 }}>÷</div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 4 }}>HAD APPLIED</label>
          <input type="number" min="0" value={num} onChange={e => onChange("num", e.target.value)} placeholder="0"
            style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontSize: 16, fontFamily: "'Libre Baskerville', serif", color: C.ink, outline: "none" }}
            onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
        </div>
        <div style={{ paddingTop: 18 }}>
          <div style={{ background: pctBg(p), border: `1px solid ${p !== null ? pctColor(p) + "44" : C.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 60, textAlign: "center" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: p !== null ? pctColor(p) : C.inkFaint }}>{p !== null ? `${p}%` : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => (<div key={p.name} style={{ color: p.color, marginBottom: 2 }}><span style={{ color: C.inkMid }}>{p.name}: </span><strong>{p.value}%</strong></div>))}
    </div>
  );
};

const HospitalInput = ({ value, onChange, hospitals }) => {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>HOSPITAL NAME</label>
      <div style={{ position: "relative" }}>
        <input type="text" value={value}
          onChange={e => { onChange(e.target.value); setFiltered(hospitals.filter(h => h.toLowerCase().includes(e.target.value.toLowerCase()) && h !== e.target.value)); setOpen(true); }}
          onFocus={() => { setFiltered(hospitals.filter(h => h !== value)); setOpen(hospitals.length > 0); }}
          placeholder="Enter or select hospital..."
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 36px 10px 12px", fontSize: 14, color: C.ink, outline: "none" }} />
        {hospitals.length > 0 && <button onClick={() => setOpen(o => !o)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.inkLight, fontSize: 12 }}>▾</button>}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 100, marginTop: 4, overflow: "hidden" }}>
          {filtered.map(h => (
            <div key={h} onClick={() => { onChange(h); setOpen(false); }}
              style={{ padding: "10px 14px", fontSize: 14, color: C.ink, cursor: "pointer", borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>{h}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const FilterBar = ({ value, onChange, label, hospitals }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em" }}>{label}</span>
    {["All", ...hospitals].map(h => (
      <button key={h} onClick={() => onChange(h)}
        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${value === h ? C.primary : C.border}`, background: value === h ? C.primary : "none", color: value === h ? "white" : C.inkMid }}>
        {h}
      </button>
    ))}
  </div>
);

// ── Email Modal ───────────────────────────────────────────────────────────────
const EmailModal = ({ onClose, onSend, sending, sessionCount, hospitalFilter }) => {
  const [to, setTo] = useState("");
  const inp = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", fontSize: 14, color: C.ink, outline: "none" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(42,38,36,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 32, width: "100%", maxWidth: 420, boxShadow: "0 8px 48px rgba(0,0,0,0.15)" }}>
        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 400, marginBottom: 8 }}>Email Report</div>
        <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 24 }}>
          A PDF report ({sessionCount} sessions{hospitalFilter !== "All" ? ` · ${hospitalFilter}` : ""}) will be attached.
        </p>
        <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>RECIPIENT EMAIL</label>
        <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" style={inp}
          onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border}
          onKeyDown={e => e.key === "Enter" && to && onSend(to)} />
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={() => onSend(to)} disabled={!to || sending}
            style={{ flex: 1, background: C.primary, border: "none", borderRadius: 8, padding: "12px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: "white", cursor: !to || sending ? "not-allowed" : "pointer", opacity: !to || sending ? 0.6 : 1 }}>
            {sending ? "SENDING..." : "SEND REPORT →"}
          </button>
          <button onClick={onClose} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 20px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.ink, cursor: "pointer" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("log");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(METRICS.slice(0, 3).map(m => m.id));
  const [hospitalFilter, setHospitalFilter] = useState("All");
  const [historyHospitalFilter, setHistoryHospitalFilter] = useState("All");
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState("");
  // Date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const summaryRef = useRef(null);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  const users = [...new Set(entries.map(e => e.logged_by).filter(Boolean))].sort();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("sessions").select("*").order("created_at", { ascending: true });
      if (error) setDbError("Could not connect to database.");
      else setEntries(data || []);
      setLoading(false);
    })();
  }, [user]);

  const handleLogout = async () => { await supabase.auth.signOut(); setEntries([]); };
  const updateMetric = (id, field, val) => setForm(f => ({ ...f, [`${id}_${field}`]: val }));

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";
    const payload = {
      date: form.date, hospital: form.hospital || null, location: form.location || null,
      protocol_for_use: form.protocol_for_use || null, notes: form.notes || null, logged_by: userName,
      ...Object.fromEntries(METRICS.flatMap(m => [[`${m.id}_num`, parseInt(form[`${m.id}_num`]) || null], [`${m.id}_den`, parseInt(form[`${m.id}_den`]) || null]])),
    };
    const { data, error } = await supabase.from("sessions").insert([payload]).select().single();
    if (error) { setSaveError("Failed to save. " + error.message); setSaving(false); return; }
    setEntries(prev => [...prev, data]);
    setForm(defaultForm()); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Apply all filters
  const applyFilters = (list, hFilter) => list.filter(e => {
    if (hFilter !== "All" && e.hospital !== hFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  const filteredDashboard = applyFilters(entries, hospitalFilter);
  const filteredHistory = applyFilters(entries, historyHospitalFilter);

  const chartData = filteredDashboard.map(e => {
    const row = { date: e.date?.slice(5) };
    METRICS.forEach(m => { row[m.label] = pct(e[`${m.id}_num`], e[`${m.id}_den`]); });
    return row;
  });

  const avgByMetric = METRICS.map(m => {
    const vals = filteredDashboard.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return { ...m, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });

  const handleExport = async () => {
    setExporting(true);
    try { await generatePptx(filteredDashboard, summary); } catch (e) { alert("PowerPoint export failed. Please try again."); }
    setExporting(false);
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try { await generatePdf(filteredDashboard, summary); } catch (e) { alert("PDF export failed. Please try again."); }
    setExportingPdf(false);
  };

  const handleEmailSend = async (to) => {
    setEmailSending(true);
    try {
      const pdfBase64 = await generatePdf(filteredDashboard, summary, true);
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to, pdfBase64, sessionCount: filteredDashboard.length,
          hospitalFilter, senderName: user?.user_metadata?.full_name || user?.email,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setShowEmailModal(false);
      setEmailSuccess(`Report sent to ${to}`);
      setTimeout(() => setEmailSuccess(""), 4000);
    } catch (e) { alert("Failed to send email. Please check your SendGrid setup."); }
    setEmailSending(false);
  };

  const handleSummarize = async () => {
    if (!filteredDashboard.length) return;
    setSummarizing(true); setSummary("");
    try {
      const rows = filteredDashboard.map(e => {
        const mStr = METRICS.map(m => `${m.label}: ${pct(e[`${m.id}_num`], e[`${m.id}_den`]) ?? "N/A"}%`).join(", ");
        return `Date: ${e.date} | Hospital: ${e.hospital || "N/A"} | Location: ${e.location || "N/A"} | ${mStr}${e.notes ? ` | Notes: ${e.notes}` : ""}`;
      }).join("\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `You are a clinical quality analyst reviewing wound care and pressure injury prevention compliance data. Analyze the following data and provide:\n1. Overall compliance trend\n2. Top performing and underperforming metrics\n3. Notable patterns by hospital or location\n4. 2-3 actionable recommendations\n\nData:\n${rows}\n\nUnder 250 words. Plain paragraphs only.` }] })
      });
      const data = await res.json();
      setSummary(data.content?.map(c => c.text || "").join("") || "Unable to generate summary.");
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { setSummary("Error generating summary. Please check API connectivity."); }
    setSummarizing(false);
  };

  const Tab = ({ id, label, badge }) => (
    <button onClick={() => setTab(id)} style={{ padding: "10px 22px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.08em", color: tab === id ? C.primary : C.inkLight, borderBottom: tab === id ? `2px solid ${C.primary}` : "2px solid transparent", transition: "all 0.15s", position: "relative" }}>
      {label}
      {badge && <span style={{ marginLeft: 6, background: C.accent, color: "white", fontSize: 8, padding: "2px 6px", borderRadius: 10 }}>{badge}</span>}
    </button>
  );

  const DateRangeFilter = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em" }}>DATE RANGE</span>
      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: C.ink, outline: "none" }} />
      <span style={{ fontSize: 11, color: C.inkLight }}>to</span>
      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: C.ink, outline: "none" }} />
      {(dateFrom || dateTo) && (
        <button onClick={() => { setDateFrom(""); setDateTo(""); }}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, color: C.inkLight, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>CLEAR</button>
      )}
    </div>
  );

  if (authLoading) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkLight }}>Loading...</div></div>;
  if (!user) return <LoginScreen onLogin={setUser} />;

  const userName = user?.user_metadata?.full_name || user?.email;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input,textarea { font-family: 'IBM Plex Sans', sans-serif; outline: none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 3px; }
        .savebtn:hover { background: ${C.primary} !important; color: white !important; border-color: ${C.primary} !important; }
        .summarize:hover { background: ${C.primaryLight} !important; }
        .export-btn:hover { opacity: 0.85 !important; }
        .signout:hover { color: ${C.accent} !important; }
      `}</style>

      {showEmailModal && <EmailModal onClose={() => setShowEmailModal(false)} onSend={handleEmailSend} sending={emailSending} sessionCount={filteredDashboard.length} hospitalFilter={hospitalFilter} />}

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(79,110,119,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <img src="/hovertech-logo.png" alt="HoverTech" style={{ height: 36, objectFit: "contain" }} />
              <div style={{ width: 1, height: 28, background: C.border }} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.15em" }}>CARETRACK</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkFaint, letterSpacing: "0.1em" }}>WOUND CARE COMPLIANCE</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {!loading && !dbError && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>● CONNECTED</span>}
              {dbError && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red }}>● DB ERROR</span>}
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight }}>{entries.length} SESSIONS</div>
              {emailSuccess && <div style={{ background: C.greenLight, border: `1px solid #b8dfc9`, borderRadius: 6, padding: "4px 12px", fontSize: 11, color: C.green }}>✓ {emailSuccess}</div>}
              <div style={{ width: 1, height: 20, background: C.border }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: isAdmin ? C.accentLight : C.primaryLight, border: `1px solid ${isAdmin ? C.accent : C.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: isAdmin ? C.accent : C.primary }}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>{userName}</div>
                  {isAdmin && <div style={{ fontSize: 9, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>ADMIN</div>}
                </div>
                <button className="signout" onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.05em", transition: "color 0.15s" }}>SIGN OUT</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 4 }}>
            <Tab id="log" label="LOG SESSION" />
            <Tab id="dashboard" label="DASHBOARD" />
            <Tab id="history" label="HISTORY" />
            {isAdmin && <Tab id="admin" label="ADMIN" badge="ADMIN" />}
          </div>
        </div>
      </div>

      {dbError && <div style={{ background: C.redLight, borderBottom: `1px solid #f0c8c8`, padding: "12px 32px" }}><div style={{ maxWidth: 1120, margin: "0 auto", fontSize: 13, color: C.red }}>⚠ {dbError}</div></div>}

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 32px 64px" }}>

        {/* ── LOG SESSION ── */}
        {tab === "log" && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400 }}>Log Session</h1>
              <p style={{ color: C.inkMid, fontSize: 13, marginTop: 4 }}>Logging as <strong>{userName}</strong></p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <HospitalInput value={form.hospital} onChange={val => setForm(f => ({ ...f, hospital: val }))} hospitals={hospitals} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>PROTOCOL FOR USE</label>
              <textarea value={form.protocol_for_use} onChange={e => setForm(f => ({ ...f, protocol_for_use: e.target.value }))} placeholder="Describe the protocol or intended use for this session..."
                rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>DATE</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink }}
                  onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>LOCATION / UNIT</label>
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. 3 North, ICU, 4 South"
                  style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink }}
                  onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {METRICS.map(m => <MetricInput key={m.id} metric={m} num={form[`${m.id}_num`]} den={form[`${m.id}_den`]} onChange={(field, val) => updateMetric(m.id, field, val)} />)}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>NOTES (OPTIONAL)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observations, context, follow-up actions..."
                rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            {saveError && <div style={{ marginBottom: 16, padding: "10px 14px", background: C.redLight, border: `1px solid #f0c8c8`, borderRadius: 8, fontSize: 13, color: C.red }}>⚠ {saveError}</div>}
            <button className="savebtn" onClick={handleSave} disabled={saving || !!dbError}
              style={{ background: saved ? C.greenLight : C.surfaceAlt, border: `1px solid ${saved ? C.green : C.borderDark}`, borderRadius: 8, padding: "12px 28px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: saved ? C.green : C.ink, cursor: saving || dbError ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: saving ? 0.6 : 1 }}>
              {saved ? "✓ SESSION SAVED" : saving ? "SAVING..." : "SAVE SESSION →"}
            </button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>Compliance Dashboard</h1>
                <p style={{ color: C.inkMid, fontSize: 13 }}>{loading ? "Loading..." : `${filteredDashboard.length} session${filteredDashboard.length !== 1 ? "s" : ""}${hospitalFilter !== "All" ? ` · ${hospitalFilter}` : ""}${dateFrom || dateTo ? ` · filtered` : ""}`}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                {hospitals.length > 0 && <FilterBar value={hospitalFilter} onChange={setHospitalFilter} label="HOSPITAL" hospitals={hospitals} />}
                <DateRangeFilter />
              </div>
            </div>
            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>Loading data...</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
                  {avgByMetric.map(m => (
                    <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                      <div style={{ fontSize: 11, color: C.inkLight, lineHeight: 1.4, marginBottom: 10 }}>{m.label}</div>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color: m.avg !== null ? pctColor(m.avg) : C.inkFaint }}>{m.avg !== null ? `${m.avg}%` : "—"}</div>
                      <div style={{ marginTop: 8, height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${m.avg ?? 0}%`, background: m.avg !== null ? pctColor(m.avg) : C.inkFaint, borderRadius: 2, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>COMPLIANCE TRENDS OVER TIME</div>
                      <div style={{ fontSize: 12, color: C.inkMid }}>Select metrics to display</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {METRICS.map((m, i) => { const active = selectedMetrics.includes(m.id); return (
                        <button key={m.id} className="metric-toggle" onClick={() => setSelectedMetrics(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                          style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${active ? LINE_COLORS[i] : C.border}`, background: active ? LINE_COLORS[i] + "22" : "none", color: active ? LINE_COLORS[i] : C.inkLight }}>
                          {m.label}
                        </button>
                      ); })}
                    </div>
                  </div>
                  {filteredDashboard.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No sessions for this filter.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -15 }}>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: C.inkLight, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: C.inkLight, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        {METRICS.map((m, i) => selectedMetrics.includes(m.id) && <Line key={m.id} type="monotone" dataKey={m.label} stroke={LINE_COLORS[i]} strokeWidth={2} dot={{ fill: LINE_COLORS[i], r: 3 }} activeDot={{ r: 5 }} connectNulls />)}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                  <button className="export-btn" onClick={handleExport} disabled={exporting || filteredDashboard.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: C.primary, border: `1px solid ${C.primary}`, borderRadius: 8, padding: "11px 18px", color: "white", cursor: filteredDashboard.length === 0 ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", opacity: filteredDashboard.length === 0 ? 0.5 : 1 }}>
                    ↓ {exporting ? "GENERATING..." : "EXPORT PPTX"}
                  </button>
                  <button className="export-btn" onClick={handlePdfExport} disabled={exportingPdf || filteredDashboard.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "11px 18px", color: "white", cursor: filteredDashboard.length === 0 ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", opacity: filteredDashboard.length === 0 ? 0.5 : 1 }}>
                    ↓ {exportingPdf ? "GENERATING..." : "EXPORT PDF"}
                  </button>
                  <button className="export-btn" onClick={() => setShowEmailModal(true)} disabled={filteredDashboard.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: C.secondary, border: `1px solid ${C.secondary}`, borderRadius: 8, padding: "11px 18px", color: "white", cursor: filteredDashboard.length === 0 ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", opacity: filteredDashboard.length === 0 ? 0.5 : 1 }}>
                    ✉ EMAIL REPORT
                  </button>
                  <button className="summarize" onClick={handleSummarize} disabled={summarizing || filteredDashboard.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 18px", color: C.ink, cursor: filteredDashboard.length === 0 ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", opacity: summarizing || filteredDashboard.length === 0 ? 0.5 : 1 }}>
                    <span style={{ color: C.primary }}>✦</span> {summarizing ? "ANALYZING..." : "AI SUMMARY"}
                  </button>
                </div>
                {(summary || summarizing) && (
                  <div ref={summaryRef} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.primary}`, borderRadius: "0 10px 10px 0", padding: "20px 24px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary, letterSpacing: "0.1em", marginBottom: 12 }}>✦ AI CLINICAL ANALYSIS</div>
                    {summarizing
                      ? <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}<style>{`@keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}`}</style></div>
                      : <p style={{ fontSize: 14, lineHeight: 1.8, color: C.inkMid, whiteSpace: "pre-wrap" }}>{summary}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400 }}>Session History</h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                {hospitals.length > 0 && <FilterBar value={historyHospitalFilter} onChange={setHistoryHospitalFilter} label="HOSPITAL" hospitals={hospitals} />}
                <DateRangeFilter />
              </div>
            </div>
            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>Loading...</div>
            ) : filteredHistory.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No sessions found for this filter.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...filteredHistory].reverse().map(e => {
                  const metrics = METRICS.map(m => ({ label: m.label, p: pct(e[`${m.id}_num`], e[`${m.id}_den`]), num: e[`${m.id}_num`], den: e[`${m.id}_den`] }));
                  return (
                    <div key={e.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 16, fontWeight: 700 }}>{e.date}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, marginTop: 2 }}>
                            {e.created_at ? `Logged ${formatTimestamp(e.created_at)}` : ""}
                          </div>
                          {e.hospital && <div style={{ fontSize: 13, color: C.primary, marginTop: 4, fontWeight: 500 }}>{e.hospital}</div>}
                          {e.location && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{e.location}</div>}
                          {e.protocol_for_use && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4, fontStyle: "italic" }}>Protocol: {e.protocol_for_use}</div>}
                          {e.logged_by && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: C.primaryLight, border: `1px solid ${C.primary}22`, borderRadius: 20, padding: "2px 10px" }}>
                              <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "white", fontWeight: 700 }}>{e.logged_by.charAt(0).toUpperCase()}</div>
                              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.primary }}>{e.logged_by}</span>
                            </div>
                          )}
                        </div>
                        {e.notes && <div style={{ fontSize: 12, color: C.inkMid, maxWidth: 360, textAlign: "right", lineHeight: 1.5, fontStyle: "italic" }}>{e.notes}</div>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                        {metrics.map(m => (
                          <div key={m.label} style={{ background: pctBg(m.p), border: `1px solid ${m.p !== null ? pctColor(m.p) + "33" : C.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginBottom: 4, lineHeight: 1.3 }}>{m.label}</div>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, fontWeight: 700, color: m.p !== null ? pctColor(m.p) : C.inkFaint }}>{m.p !== null ? `${m.p}%` : "—"}</div>
                            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginTop: 2 }}>{m.num}/{m.den}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN ── */}
        {tab === "admin" && isAdmin && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>Admin Dashboard</h1>
              <p style={{ color: C.inkMid, fontSize: 13 }}>Full visibility across all users, sessions, and hospitals.</p>
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "Total Sessions", value: entries.length },
                { label: "Hospitals", value: hospitals.length },
                { label: "Active Users", value: users.length },
                { label: "Avg Overall", value: (() => { const vals = METRICS.flatMap(m => entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null)); return vals.length ? `${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}%` : "—"; })() },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: C.inkLight, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 32, fontWeight: 700, color: C.primary }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Per-user breakdown */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", marginBottom: 20 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>SESSIONS BY USER</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {users.map(u => {
                  const userEntries = entries.filter(e => e.logged_by === u);
                  const overallVals = METRICS.flatMap(m => userEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                  const overall = overallVals.length ? Math.round(overallVals.reduce((a,b)=>a+b,0)/overallVals.length) : null;
                  const lastSession = userEntries[userEntries.length - 1];
                  return (
                    <div key={u} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: C.bg, borderRadius: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.primaryLight, border: `1px solid ${C.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: C.primary, flexShrink: 0 }}>{u.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{u}</div>
                        <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>
                          {userEntries.length} session{userEntries.length !== 1 ? "s" : ""}
                          {lastSession && ` · Last: ${formatTimestamp(lastSession.created_at, lastSession.date)}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: overall !== null ? pctColor(overall) : C.inkFaint }}>{overall !== null ? `${overall}%` : "—"}</div>
                        <div style={{ fontSize: 10, color: C.inkLight }}>avg compliance</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-hospital breakdown */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>ALL SESSIONS (ADMIN VIEW)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...entries].reverse().map(e => {
                  const overallVals = METRICS.map(m => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
                  const overall = overallVals.length ? Math.round(overallVals.reduce((a,b)=>a+b,0)/overallVals.length) : null;
                  return (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.bg, borderRadius: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{e.date} {e.hospital && <span style={{ color: C.primary }}>· {e.hospital}</span>}</div>
                        <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>
                          {e.location && `${e.location} · `}
                          {formatTimestamp(e.created_at)}
                          {e.logged_by && <span style={{ marginLeft: 6, background: C.primaryLight, color: C.primary, borderRadius: 10, padding: "1px 8px", fontSize: 10 }}>{e.logged_by}</span>}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: overall !== null ? pctColor(overall) : C.inkFaint }}>{overall !== null ? `${overall}%` : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

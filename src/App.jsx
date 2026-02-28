import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { generatePptx } from "./generatePptx";
import { generatePdf } from "./generatePdf";
import { generateXlsx } from "./generateXlsx";

const ADMIN_EMAILS = ["arobinson@hovertechinternational.com", "edoherty@hovertechinternational.com"];

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
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
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
      if (error) { setError(error.message); }
      else {
        // Check if user is deactivated
        const { data: profile } = await supabase.from("user_profiles").select("is_active").eq("email", email).single();
        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          setError("Your account has been deactivated. Please contact an administrator.");
        } else {
          onLogin(data.user);
        }
      }
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

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("log");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState([]); // metric-only, for national avg
  const [allEntriesFull, setAllEntriesFull] = useState([]); // admin only, full data
  const [dbError, setDbError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem("caretrack_offline_queue") || "[]"); } catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [userProfiles, setUserProfiles] = useState([]);
  const [adminSection, setAdminSection] = useState("sessions"); // sessions | audit | users
  const [reassignFrom, setReassignFrom] = useState(null);
  const [reassignTo, setReassignTo] = useState("");

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("caretrack_onboarded"));
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Changelog
  const [showChangelog, setShowChangelog] = useState(false);
  const lastSeenVersion = localStorage.getItem("caretrack_changelog_seen");
  const CURRENT_VERSION = "2.0";
  const [changelogBadge, setChangelogBadge] = useState(lastSeenVersion !== CURRENT_VERSION);

  // White-label
  const [hospitalBranding, setHospitalBranding] = useState(() => {
    try { return JSON.parse(localStorage.getItem("caretrack_branding") || "{}"); } catch { return {}; }
  });
  const [showBrandingEditor, setShowBrandingEditor] = useState(false);

  // Excel export
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [photos, setPhotos] = useState([]); // files staged for new session
  const [photoUploading, setPhotoUploading] = useState(false);
  const [expandedPhotos, setExpandedPhotos] = useState({}); // { sessionId: bool }
  const [editPhotos, setEditPhotos] = useState([]); // files staged for edit
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(METRICS.slice(0, 3).map(m => m.id));
  const [hospitalFilter, setHospitalFilter] = useState("All");
  const [historyHospitalFilter, setHistoryHospitalFilter] = useState("All");
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const summaryRef = useRef(null);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  const users = [...new Set(allEntriesFull.map(e => e.logged_by).filter(Boolean))].sort();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Active hospital branding
  const activeBranding = hospitalFilter !== "All" && hospitalBranding[hospitalFilter]
    ? hospitalBranding[hospitalFilter]
    : null;

  // Excel export handler
  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      generateXlsx(filteredDashboard, hospitalFilter, user?.user_metadata?.full_name || user?.email || "");
    } catch (e) { alert("Excel export failed. Please try again."); }
    setExportingXlsx(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (!user) return;
      // Ignore when typing in inputs
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "1") setTab("log");
      if (e.key === "2") setTab("dashboard");
      if (e.key === "3") setTab("history");
      if (e.key === "4") setTab("performers");
      if (e.key === "5" && isAdmin) setTab("admin");
      if (e.key === "?" ) setShowChangelog(true);
      if (e.key === "Escape") { setShowChangelog(false); setShowOnboarding(false); setShowBrandingEditor(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [user, isAdmin]);

  // Audit log helper
  const logAudit = async (action, details = {}, targetUser = null, sessionId = null) => {
    const performedBy = user?.user_metadata?.full_name || user?.email || "Unknown";
    try {
      await supabase.from("audit_log").insert([{
        action, performed_by: performedBy, target_user: targetUser,
        session_id: sessionId, details,
      }]);
    } catch (e) { console.warn("Audit log failed:", e); }
  };

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOnline || !user || offlineQueue.length === 0) return;
    (async () => {
      setSyncing(true);
      const userName = user?.user_metadata?.full_name || user?.email;
      const failed = [];
      let successCount = 0;
      for (const session of offlineQueue) {
        const { queuedAt, tempId, ...payload } = session;
        payload.logged_by = userName;
        const { data, error } = await supabase.from("sessions").insert([payload]).select().single();
        if (error) { failed.push(session); }
        else {
          setEntries(prev => [...prev.filter(e => e.id !== tempId), data]);
          successCount++;
        }
      }
      const newQueue = failed;
      setOfflineQueue(newQueue);
      localStorage.setItem("caretrack_offline_queue", JSON.stringify(newQueue));
      setSyncing(false);
      if (successCount > 0) {
        setSyncResult(`✓ Synced ${successCount} offline session${successCount !== 1 ? "s" : ""}`);
        setTimeout(() => setSyncResult(null), 4000);
      }
    })();
  }, [isOnline, user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const userName = user?.user_metadata?.full_name || user?.email;
      const isAdminUser = ADMIN_EMAILS.includes(user?.email);

      // Step 1: Fetch user's own sessions to discover which hospitals they've logged for
      const { data: ownData, error } = await supabase.from("sessions")
        .select("*")
        .eq("logged_by", userName)
        .order("created_at", { ascending: true });
      if (error) { setDbError("Could not connect to database."); setLoading(false); return; }

      // Step 2: Get the unique hospitals this user has logged for
      const userHospitals = [...new Set((ownData || []).map(e => e.hospital).filter(Boolean))];

      // Step 3: Fetch ALL sessions for those hospitals (from any user)
      let allHospitalData = ownData || [];
      if (userHospitals.length > 0) {
        const { data: hospitalData } = await supabase.from("sessions")
          .select("*")
          .in("hospital", userHospitals)
          .order("created_at", { ascending: true });
        allHospitalData = hospitalData || ownData || [];
      }

      setEntries(allHospitalData);

      // Fetch all sessions for national average (metric values only, no PII)
      const { data: allData } = await supabase.from("sessions")
        .select("matt_applied_num,matt_applied_den,wedges_applied_num,wedges_applied_den,turning_criteria_num,turning_criteria_den,matt_proper_num,matt_proper_den,wedges_in_room_num,wedges_in_room_den,wedge_offload_num,wedge_offload_den,air_supply_num,air_supply_den")
        .order("created_at", { ascending: true });
      setAllEntries(allData || []);

      // Admins get all sessions + audit log + user profiles
      if (isAdminUser) {
        const { data: adminData } = await supabase.from("sessions").select("*").order("created_at", { ascending: true });
        setAllEntriesFull(adminData || []);
        const { data: auditData } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
        setAuditLog(auditData || []);
        const { data: profileData } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: true });
        setUserProfiles(profileData || []);
      }

      // Register/update user profile on login
      await supabase.from("user_profiles").upsert([{
        email: user.email,
        full_name: user?.user_metadata?.full_name || user.email,
      }], { onConflict: "email", ignoreDuplicates: true });
      setLoading(false);
    })();
  }, [user]);

  const handleLogout = async () => { await supabase.auth.signOut(); setEntries([]); };
  const updateMetric = (id, field, val) => setForm(f => ({ ...f, [`${id}_${field}`]: val }));

  const handleSave = async () => {
    // Validation
    if (!form.date) { setSaveError("Date is required."); return; }
    if (!form.hospital.trim()) { setSaveError("Hospital name is required."); return; }
    if (!form.location.trim()) { setSaveError("Location / Unit is required."); return; }
    const hasMetric = METRICS.some(m => form[`${m.id}_num`] !== "" && form[`${m.id}_den`] !== "");
    if (!hasMetric) { setSaveError("Please fill in at least one metric before saving."); return; }

    // Duplicate check
    const duplicate = entries.find(e => e.date === form.date && e.hospital === form.hospital && e.location === form.location);
    if (duplicate) {
      const proceed = window.confirm(`A session for ${form.hospital} · ${form.location} on ${form.date} already exists. Save anyway?`);
      if (!proceed) return;
    }

    setSaving(true); setSaveError(null);
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";
    const payload = {
      date: form.date, hospital: form.hospital || null, location: form.location || null,
      protocol_for_use: form.protocol_for_use || null, notes: form.notes || null, logged_by: userName,
      ...Object.fromEntries(METRICS.flatMap(m => [[`${m.id}_num`, parseInt(form[`${m.id}_num`]) || null], [`${m.id}_den`, parseInt(form[`${m.id}_den`]) || null]])),
    };
    // If offline, queue the session locally
    if (!isOnline) {
      const tempId = `offline_${Date.now()}`;
      const offlineSession = { ...payload, id: tempId, created_at: new Date().toISOString(), tempId, queuedAt: Date.now() };
      const newQueue = [...offlineQueue, offlineSession];
      setOfflineQueue(newQueue);
      localStorage.setItem("caretrack_offline_queue", JSON.stringify(newQueue));
      setEntries(prev => [...prev, offlineSession]);
      setForm(defaultForm()); setSaving(false); setSaved(true);
      setSavedAt(new Date().toISOString());
      setTimeout(() => setSaved(false), 4000);
      return;
    }

    const { data, error } = await supabase.from("sessions").insert([payload]).select().single();
    if (error) { setSaveError("Failed to save. " + error.message); setSaving(false); return; }
    // Upload any staged photos
    let finalData = data;
    if (photos.length > 0) {
      setPhotoUploading(true);
      const urls = await uploadPhotos(photos, data.id);
      if (urls.length > 0) {
        const allUrls = await savePhotoUrls(data.id, urls, []);
        finalData = { ...data, photos: allUrls };
      }
      setPhotoUploading(false);
      setPhotos([]);
    }
    setEntries(prev => [...prev, finalData]);
    setForm(defaultForm()); setSaving(false); setSaved(true);
    setSavedAt(data.created_at || new Date().toISOString());
    setTimeout(() => setSaved(false), 4000);
    await logAudit("SESSION_CREATED", { hospital: payload.hospital, location: payload.location, date: payload.date }, null, data.id);
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

  // National avg is constant per metric — rendered as flat reference lines
  const nationalAvgByMetric = METRICS.reduce((acc, m) => {
    const vals = allEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    acc[m.label] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    return acc;
  }, {});

  const chartDataWithNational = chartData.map(row => {
    const enriched = { ...row };
    METRICS.forEach(m => {
      if (selectedMetrics.includes(m.id)) {
        enriched[`${m.label} (National)`] = nationalAvgByMetric[m.label];
      }
    });
    return enriched;
  });

  // Month-over-month calculation
  const momData = (() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthEntries = filteredDashboard.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const lastMonthEntries = filteredDashboard.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const avg = (arr) => {
      const vals = METRICS.flatMap(m => arr.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    const metricAvg = (arr, m) => {
      const vals = arr.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };

    const thisAvg = avg(thisMonthEntries);
    const lastAvg = avg(lastMonthEntries);
    const delta = thisAvg !== null && lastAvg !== null ? thisAvg - lastAvg : null;

    const metricDeltas = METRICS.map(m => ({
      ...m,
      this: metricAvg(thisMonthEntries, m),
      last: metricAvg(lastMonthEntries, m),
      delta: metricAvg(thisMonthEntries, m) !== null && metricAvg(lastMonthEntries, m) !== null
        ? metricAvg(thisMonthEntries, m) - metricAvg(lastMonthEntries, m) : null,
    }));

    const monthName = (m, y) => new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return {
      thisMonth: monthName(thisMonth, thisYear),
      lastMonth: monthName(lastMonth, lastMonthYear),
      thisAvg, lastAvg, delta,
      thisSessions: thisMonthEntries.length,
      lastSessions: lastMonthEntries.length,
      metricDeltas,
      hasData: thisMonthEntries.length > 0 || lastMonthEntries.length > 0,
    };
  })();

  const avgByMetric = METRICS.map(m => {
    const vals = filteredDashboard.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    const nationalVals = allEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return {
      ...m,
      avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      national: nationalVals.length ? Math.round(nationalVals.reduce((a, b) => a + b, 0) / nationalVals.length) : null,
    };
  });

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditForm({ ...e });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    setEditSaving(true);
    const payload = {
      date: editForm.date,
      hospital: editForm.hospital || null,
      location: editForm.location || null,
      protocol_for_use: editForm.protocol_for_use || null,
      notes: editForm.notes || null,
      ...Object.fromEntries(METRICS.flatMap(m => [
        [`${m.id}_num`, parseInt(editForm[`${m.id}_num`]) || null],
        [`${m.id}_den`, parseInt(editForm[`${m.id}_den`]) || null]
      ])),
    };
    const { data, error } = await supabase.from("sessions").update(payload).eq("id", editingId).select().single();
    if (error) { alert("Failed to save: " + error.message); setEditSaving(false); return; }

    // Upload any new photos staged during edit
    let finalData = data;
    if (editPhotos.length > 0) {
      const urls = await uploadPhotos(editPhotos, editingId);
      if (urls.length > 0) {
        const allUrls = await savePhotoUrls(editingId, urls, editForm.photos || []);
        finalData = { ...data, photos: allUrls };
      }
      setEditPhotos([]);
    }

    // Build diff of what changed
    const original = entries.find(e => e.id === editingId) || {};
    const changed = {};
    ["date","hospital","location","protocol_for_use","notes",...METRICS.flatMap(m=>[`${m.id}_num`,`${m.id}_den`])].forEach(k => {
      if (String(original[k]||"") !== String(finalData[k]||"")) changed[k] = { from: original[k], to: finalData[k] };
    });

    setEntries(prev => prev.map(e => e.id === editingId ? finalData : e));
    setAllEntriesFull(prev => prev.map(e => e.id === editingId ? finalData : e));
    await logAudit("SESSION_EDITED", { changed, hospital: finalData.hospital, date: finalData.date }, null, editingId);
    const { data: freshAudit } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (freshAudit) setAuditLog(freshAudit);
    setEditingId(null);
    setEditForm({});
    setEditSaving(false);
  };

  // Upload photos to Supabase Storage and return public URLs
  const uploadPhotos = async (files, sessionId) => {
    const urls = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${sessionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("session-photos").upload(path, file, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("session-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  // Save photo URLs array back to session record
  const savePhotoUrls = async (sessionId, newUrls, existingUrls = []) => {
    const all = [...(existingUrls || []), ...newUrls];
    await supabase.from("sessions").update({ photos: all }).eq("id", sessionId);
    return all;
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    const session = allEntriesFull.find(e => e.id === id) || entries.find(e => e.id === id);
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) { alert("Failed to delete session: " + error.message); return; }
    setAllEntriesFull(prev => prev.filter(e => e.id !== id));
    setEntries(prev => prev.filter(e => e.id !== id));
    await logAudit("SESSION_DELETED", { hospital: session?.hospital, location: session?.location, date: session?.date, logged_by: session?.logged_by }, session?.logged_by, id);
    const { data: freshAudit } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (freshAudit) setAuditLog(freshAudit);
  };

  const handleExport = async () => {
    setExporting(true);
    try { await generatePptx(filteredDashboard, summary, hospitalFilter, user?.user_metadata?.full_name || user?.email || ""); } catch (e) { alert("PowerPoint export failed. Please try again."); }
    setExporting(false);
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try { await generatePdf(filteredDashboard, summary, false, hospitalFilter, user?.user_metadata?.full_name || user?.email || ""); } catch (e) { alert("PDF export failed. Please try again."); }
    setExportingPdf(false);
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
              {!isOnline
                ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber }}>● OFFLINE{offlineQueue.length > 0 ? ` · ${offlineQueue.length} QUEUED` : ""}</span>
                : syncing
                  ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>● SYNCING...</span>
                  : !loading && !dbError
                    ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>● CONNECTED</span>
                    : dbError
                      ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red }}>● DB ERROR</span>
                      : null
              }
              {syncResult && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>{syncResult}</span>}
              <button onClick={() => { setShowChangelog(true); setChangelogBadge(false); localStorage.setItem("caretrack_changelog_seen", CURRENT_VERSION); }}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", position: "relative" }}>
                WHAT'S NEW {changelogBadge && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: C.red }} />}
              </button>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight }}>{entries.length} SESSIONS{offlineQueue.length > 0 ? ` (${offlineQueue.length} pending)` : ""}</div>
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
            <Tab id="performers" label="PERFORMERS" />
            {isAdmin && <Tab id="admin" label="ADMIN" badge="ADMIN" />}
          </div>
        </div>
      </div>

      {dbError && <div style={{ background: C.redLight, borderBottom: `1px solid #f0c8c8`, padding: "12px 32px" }}><div style={{ maxWidth: 1120, margin: "0 auto", fontSize: 13, color: C.red }}>⚠ {dbError}</div></div>}
      {!isOnline && (
        <div style={{ background: "#fdf6e8", borderBottom: `1px solid #e8d4a0`, padding: "10px 32px" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, color: C.amber }}>
              ⚠ You're offline — sessions will be saved locally and synced automatically when you reconnect.
              {offlineQueue.length > 0 && <strong> {offlineQueue.length} session{offlineQueue.length !== 1 ? "s" : ""} pending sync.</strong>}
            </div>
          </div>
        </div>
      )}

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
            {/* Photo Upload */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 8 }}>ATTACH PHOTOS (UP TO 3)</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {photos.map((f, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
                    <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, border: "none", color: "white", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <label style={{ width: 72, height: 72, border: `2px dashed ${C.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.inkLight, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", gap: 4 }}>
                    <span style={{ fontSize: 20 }}>+</span>
                    <span>PHOTO</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={ev => { const f = ev.target.files[0]; if (f) setPhotos(prev => [...prev, f]); ev.target.value = ""; }} />
                  </label>
                )}
              </div>
              {photoUploading && <div style={{ marginTop: 8, fontSize: 11, color: C.inkMid, fontFamily: "'IBM Plex Mono', monospace" }}>Uploading photos...</div>}
            </div>

            {saveError && <div style={{ marginBottom: 16, padding: "10px 14px", background: C.redLight, border: `1px solid #f0c8c8`, borderRadius: 8, fontSize: 13, color: C.red }}>⚠ {saveError}</div>}
            <button className="savebtn" onClick={handleSave} disabled={saving || !!dbError}
              style={{ background: saved ? C.greenLight : !isOnline ? C.amberLight : C.surfaceAlt, border: `1px solid ${saved ? C.green : !isOnline ? C.amber : C.borderDark}`, borderRadius: 8, padding: "12px 28px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: saved ? C.green : !isOnline ? C.amber : C.ink, cursor: saving ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: saving ? 0.6 : 1 }}>
              {saved ? `✓ SAVED · ${savedAt ? new Date(savedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}` : saving ? "SAVING..." : !isOnline ? "SAVE OFFLINE →" : "SAVE SESSION →"}
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
                  {avgByMetric.map(m => {
                    const diff = m.avg !== null && m.national !== null ? m.avg - m.national : null;
                    const showNational = hospitalFilter !== "All" && m.national !== null;
                    return (
                    <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                      <div style={{ fontSize: 11, color: C.inkLight, lineHeight: 1.4, marginBottom: 10 }}>{m.label}</div>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color: m.avg !== null ? pctColor(m.avg) : C.inkFaint }}>{m.avg !== null ? `${m.avg}%` : "—"}</div>
                      <div style={{ marginTop: 8, height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                        <div style={{ height: "100%", width: `${m.avg ?? 0}%`, background: m.avg !== null ? pctColor(m.avg) : C.inkFaint, borderRadius: 2, transition: "width 0.6s ease" }} />
                        {showNational && <div style={{ position: "absolute", top: -2, left: `${m.national}%`, width: 2, height: 8, background: C.inkLight, borderRadius: 1, transform: "translateX(-50%)" }} />}
                      </div>
                      {showNational && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>
                            National avg: <span style={{ color: C.ink }}>{m.national}%</span>
                          </div>
                          {diff !== null && (
                            <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: diff >= 0 ? C.green : C.red }}>
                              {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
                            </div>
                          )}
                        </div>
                      )}
                      {!showNational && m.national !== null && (
                        <div style={{ marginTop: 8, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint }}>
                          National avg: {m.national}%
                        </div>
                      )}
                    </div>
                  )})}
                </div>
                {/* Month-over-month card */}
                {momData.hasData && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>MONTH-OVER-MONTH</div>
                        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 400 }}>
                          {momData.thisMonth} vs {momData.lastMonth}
                        </div>
                      </div>
                      {momData.delta !== null && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 36, fontWeight: 700, color: momData.delta >= 0 ? C.green : C.red, lineHeight: 1 }}>
                            {momData.delta >= 0 ? "+" : ""}{momData.delta}%
                          </div>
                          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginTop: 4 }}>overall change</div>
                        </div>
                      )}
                    </div>

                    {/* This month vs last month summary row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                      {[
                        { label: momData.thisMonth, avg: momData.thisAvg, sessions: momData.thisSessions, isCurrent: true },
                        { label: momData.lastMonth, avg: momData.lastAvg, sessions: momData.lastSessions, isCurrent: false },
                      ].map(m => (
                        <div key={m.label} style={{ background: m.isCurrent ? C.primaryLight : C.bg, border: `1px solid ${m.isCurrent ? C.primary + "33" : C.border}`, borderRadius: 10, padding: "14px 18px" }}>
                          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: m.isCurrent ? C.primary : C.inkLight, marginBottom: 6 }}>
                            {m.isCurrent ? "▶ " : ""}{m.label}
                          </div>
                          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color: m.avg !== null ? pctColor(m.avg) : C.inkFaint }}>
                            {m.avg !== null ? `${m.avg}%` : "—"}
                          </div>
                          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 4 }}>{m.sessions} session{m.sessions !== 1 ? "s" : ""}</div>
                        </div>
                      ))}
                    </div>

                    {/* Per-metric breakdown */}
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em", marginBottom: 10 }}>BY METRIC</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {momData.metricDeltas.filter(m => m.this !== null || m.last !== null).map(m => (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: C.ink, flex: 1 }}>{m.label}</div>
                          <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, minWidth: 36, textAlign: "right" }}>
                            {m.last !== null ? `${m.last}%` : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: C.inkFaint }}>→</div>
                          <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: m.this !== null ? pctColor(m.this) : C.inkFaint, minWidth: 36, textAlign: "right", fontWeight: 600 }}>
                            {m.this !== null ? `${m.this}%` : "—"}
                          </div>
                          {m.delta !== null ? (
                            <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: m.delta > 0 ? C.green : m.delta < 0 ? C.red : C.inkLight, minWidth: 44, textAlign: "right" }}>
                              {m.delta > 0 ? "▲ +" : m.delta < 0 ? "▼ " : "– "}{m.delta !== 0 ? `${Math.abs(m.delta)}%` : "no change"}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint, minWidth: 44, textAlign: "right" }}>new</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    <div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartDataWithNational} margin={{ top: 5, right: 20, bottom: 5, left: -15 }}>
                          <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: C.inkLight, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: C.inkLight, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                          <Tooltip content={<CustomTooltip />} />
                          {METRICS.map((m, i) => selectedMetrics.includes(m.id) && <Line key={m.id} type="monotone" dataKey={m.label} stroke={LINE_COLORS[i]} strokeWidth={2} dot={{ fill: LINE_COLORS[i], r: 3 }} activeDot={{ r: 5 }} connectNulls />)}
                          {METRICS.map((m, i) => selectedMetrics.includes(m.id) && nationalAvgByMetric[m.label] !== null && (
                            <Line key={`${m.id}-national`} type="monotone" dataKey={`${m.label} (National)`} stroke={LINE_COLORS[i]} strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} connectNulls legendType="none" />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, paddingLeft: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={C.inkLight} strokeWidth="2" /></svg>
                          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>Selected hospital</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke={C.inkLight} strokeWidth="1.5" strokeDasharray="5 4" /></svg>
                          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>National average</span>
                        </div>
                      </div>
                    </div>
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
                  <button className="export-btn" onClick={handleExportXlsx} disabled={exportingXlsx || filteredDashboard.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "#217346", border: "1px solid #1a5c38", borderRadius: 8, padding: "11px 18px", color: "white", cursor: filteredDashboard.length === 0 ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", opacity: filteredDashboard.length === 0 ? 0.5 : 1 }}>
                    ↓ {exportingXlsx ? "GENERATING..." : "EXPORT XLSX"}
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
                  const isOfflinePending = e.id && String(e.id).startsWith("offline_");
                  const isEditing = editingId === e.id;
                  const ef = isEditing ? editForm : e;
                  const metrics = METRICS.map(m => ({ label: m.label, p: pct(ef[`${m.id}_num`], ef[`${m.id}_den`]), num: ef[`${m.id}_num`], den: ef[`${m.id}_den`] }));
                  const inpStyle = { background: C.bg, border: `1px solid ${C.primary}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, color: C.ink, width: "100%", outline: "none" };
                  return (
                    <div key={e.id} style={{ background: C.surface, border: `1px solid ${isEditing ? C.primary : C.border}`, borderRadius: 12, padding: "18px 20px", transition: "border-color 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ flex: 1, marginRight: 16 }}>
                          {isEditing ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                              <div>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>DATE</label>
                                <input type="date" value={ef.date || ""} onChange={ev => setEditForm(f => ({ ...f, date: ev.target.value }))} style={inpStyle} />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>HOSPITAL</label>
                                <input type="text" value={ef.hospital || ""} onChange={ev => setEditForm(f => ({ ...f, hospital: ev.target.value }))} style={inpStyle} />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>LOCATION</label>
                                <input type="text" value={ef.location || ""} onChange={ev => setEditForm(f => ({ ...f, location: ev.target.value }))} style={inpStyle} />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>PROTOCOL</label>
                                <input type="text" value={ef.protocol_for_use || ""} onChange={ev => setEditForm(f => ({ ...f, protocol_for_use: ev.target.value }))} style={inpStyle} />
                              </div>
                              <div style={{ gridColumn: "span 2" }}>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>NOTES</label>
                                <input type="text" value={ef.notes || ""} onChange={ev => setEditForm(f => ({ ...f, notes: ev.target.value }))} style={inpStyle} />
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 16, fontWeight: 700 }}>{e.date}</div>
                            {isOfflinePending && <span style={{ background: "#fdf6e8", border: `1px solid ${C.amber}44`, borderRadius: 10, padding: "1px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.amber, letterSpacing: "0.05em" }}>PENDING SYNC</span>}
                          </div>
                              {e.created_at && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px" }}>
                                  <span style={{ fontSize: 9, color: C.inkLight }}>🕐</span>
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkMid, letterSpacing: "0.03em" }}>
                                    {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    {" · "}
                                    {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              )}
                              {e.hospital && <div style={{ fontSize: 13, color: C.primary, marginTop: 4, fontWeight: 500 }}>{e.hospital}</div>}
                              {e.location && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{e.location}</div>}
                              {e.protocol_for_use && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4, fontStyle: "italic" }}>Protocol: {e.protocol_for_use}</div>}
                              {e.logged_by && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: C.primaryLight, border: `1px solid ${C.primary}22`, borderRadius: 20, padding: "2px 10px" }}>
                                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "white", fontWeight: 700 }}>{e.logged_by.charAt(0).toUpperCase()}</div>
                                  <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.primary }}>{e.logged_by}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                          {!isEditing && e.notes && <div style={{ fontSize: 12, color: C.inkMid, maxWidth: 280, textAlign: "right", lineHeight: 1.5, fontStyle: "italic" }}>{e.notes}</div>}
                          <div style={{ display: "flex", gap: 6 }}>
                            {isEditing ? (
                              <>
                                <button onClick={saveEdit} disabled={editSaving}
                                  style={{ background: C.primary, border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em" }}>
                                  {editSaving ? "SAVING..." : "SAVE"}
                                </button>
                                <button onClick={cancelEdit}
                                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>
                                  CANCEL
                                </button>
                              </>
                            ) : (
                              <button onClick={() => startEdit(e)}
                                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", letterSpacing: "0.05em" }}>
                                EDIT
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {isEditing ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                          {METRICS.map(m => (
                            <div key={m.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginBottom: 4, lineHeight: 1.3 }}>{m.label}</div>
                              <input type="number" min="0" placeholder="num" value={editForm[`${m.id}_num`] ?? ""} onChange={ev => setEditForm(f => ({ ...f, [`${m.id}_num`]: ev.target.value }))}
                                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 6px", fontSize: 12, color: C.ink, marginBottom: 4, outline: "none" }} />
                              <input type="number" min="0" placeholder="den" value={editForm[`${m.id}_den`] ?? ""} onChange={ev => setEditForm(f => ({ ...f, [`${m.id}_den`]: ev.target.value }))}
                                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 6px", fontSize: 12, color: C.ink, outline: "none" }} />
                              <div style={{ fontSize: 11, fontWeight: 700, color: pctColor(pct(editForm[`${m.id}_num`], editForm[`${m.id}_den`])), textAlign: "center", marginTop: 4 }}>
                                {pct(editForm[`${m.id}_num`], editForm[`${m.id}_den`]) !== null ? `${pct(editForm[`${m.id}_num`], editForm[`${m.id}_den`])}%` : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                          {metrics.map(m => (
                            <div key={m.label} style={{ background: pctBg(m.p), border: `1px solid ${m.p !== null ? pctColor(m.p) + "33" : C.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginBottom: 4, lineHeight: 1.3 }}>{m.label}</div>
                              <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, fontWeight: 700, color: m.p !== null ? pctColor(m.p) : C.inkFaint }}>{m.p !== null ? `${m.p}%` : "—"}</div>
                              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginTop: 2 }}>{m.num}/{m.den}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Photo section — edit mode upload + view mode thumbnails */}
                      {isEditing && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 8 }}>PHOTOS ({((e.photos || []).length + editPhotos.length)}/3)</div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            {(e.photos || []).map((url, i) => (
                              <div key={i} style={{ position: "relative" }}>
                                <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
                              </div>
                            ))}
                            {editPhotos.map((f, i) => (
                              <div key={`new-${i}`} style={{ position: "relative" }}>
                                <img src={URL.createObjectURL(f)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `2px solid ${C.primary}` }} />
                                <button onClick={() => setEditPhotos(prev => prev.filter((_, j) => j !== i))}
                                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, border: "none", color: "white", fontSize: 10, cursor: "pointer" }}>✕</button>
                              </div>
                            ))}
                            {((e.photos || []).length + editPhotos.length) < 3 && (
                              <label style={{ width: 72, height: 72, border: `2px dashed ${C.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.inkLight, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", gap: 4 }}>
                                <span style={{ fontSize: 20 }}>+</span>
                                <span>PHOTO</span>
                                <input type="file" accept="image/*" style={{ display: "none" }} onChange={ev => { const f = ev.target.files[0]; if (f) setEditPhotos(prev => [...prev, f]); ev.target.value = ""; }} />
                              </label>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View mode: photo badge + expandable thumbnails */}
                      {!isEditing && e.photos && e.photos.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <button onClick={() => setExpandedPhotos(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                            style={{ background: C.primaryLight, border: `1px solid ${C.primary}22`, borderRadius: 20, padding: "3px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            📷 {e.photos.length} PHOTO{e.photos.length !== 1 ? "S" : ""} {expandedPhotos[e.id] ? "▲" : "▼"}
                          </button>
                          {expandedPhotos[e.id] && (
                            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                              {e.photos.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt={`Photo ${i + 1}`} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", transition: "transform 0.15s" }}
                                    onMouseEnter={el => el.target.style.transform = "scale(1.04)"}
                                    onMouseLeave={el => el.target.style.transform = "scale(1)"} />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN ── */}
        {tab === "performers" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>Performers</h1>
              <p style={{ color: C.inkMid, fontSize: 13 }}>Ranked by overall average compliance across all metrics.</p>
            </div>

            {(() => {
              // Build hospital rankings
              const hospitalMap = {};
              entries.forEach(e => {
                if (!e.hospital) return;
                if (!hospitalMap[e.hospital]) hospitalMap[e.hospital] = [];
                hospitalMap[e.hospital].push(e);
              });
              const hospitalRankings = Object.entries(hospitalMap).map(([hospital, sessions]) => {
                const vals = METRICS.flatMap(m => sessions.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                // Trend: compare last 3 sessions vs previous 3
                const sorted = [...sessions].sort((a, b) => (a.created_at || a.date) > (b.created_at || b.date) ? 1 : -1);
                const recent = sorted.slice(-3);
                const previous = sorted.slice(-6, -3);
                const recentAvg = recent.length ? Math.round(METRICS.flatMap(m => recent.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null)).reduce((a, b) => a + b, 0) / METRICS.flatMap(m => recent.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null)).length) : null;
                const prevAvg = previous.length ? Math.round(METRICS.flatMap(m => previous.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null)).reduce((a, b) => a + b, 0) / METRICS.flatMap(m => previous.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null)).length) : null;
                const trend = (recentAvg !== null && prevAvg !== null) ? recentAvg - prevAvg : null;
                return { name: hospital, avg, sessions: sessions.length, trend };
              }).filter(h => h.avg !== null).sort((a, b) => b.avg - a.avg);

              // Build location rankings
              const locationMap = {};
              entries.forEach(e => {
                if (!e.location) return;
                const key = e.hospital ? `${e.location} · ${e.hospital}` : e.location;
                if (!locationMap[key]) locationMap[key] = [];
                locationMap[key].push(e);
              });
              const locationRankings = Object.entries(locationMap).map(([location, sessions]) => {
                const vals = METRICS.flatMap(m => sessions.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                const sorted = [...sessions].sort((a, b) => (a.created_at || a.date) > (b.created_at || b.date) ? 1 : -1);
                const recent = sorted.slice(-3);
                const previous = sorted.slice(-6, -3);
                const recentVals = METRICS.flatMap(m => recent.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                const prevVals = METRICS.flatMap(m => previous.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                const recentAvg = recentVals.length ? Math.round(recentVals.reduce((a,b) => a+b,0) / recentVals.length) : null;
                const prevAvg = prevVals.length ? Math.round(prevVals.reduce((a,b) => a+b,0) / prevVals.length) : null;
                const trend = (recentAvg !== null && prevAvg !== null) ? recentAvg - prevAvg : null;
                return { name: location, avg, sessions: sessions.length, trend };
              }).filter(l => l.avg !== null).sort((a, b) => b.avg - a.avg);

              const RankingTable = ({ title, icon, rankings }) => {
                if (rankings.length === 0) return (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 8 }}>{icon} {title}</div>
                    <div style={{ fontSize: 13, color: C.inkLight }}>No data yet — log sessions with {title.toLowerCase()} to see rankings.</div>
                  </div>
                );
                const top = rankings.slice(0, 3);
                const bottom = rankings.length > 3 ? rankings.slice(-3).reverse() : [];
                const medals = ["🥇", "🥈", "🥉"];

                const Row = ({ item, rank, showMedal }) => {
                  const trendColor = item.trend === null ? C.inkFaint : item.trend > 0 ? C.green : item.trend < 0 ? C.red : C.inkLight;
                  const trendIcon = item.trend === null ? "" : item.trend > 0 ? "▲" : item.trend < 0 ? "▼" : "–";
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.bg, borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 }}>{showMedal ? medals[rank] : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkFaint }}>#{rankings.length - rank}</span>}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                        <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginTop: 2 }}>{item.sessions} session{item.sessions !== 1 ? "s" : ""}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {item.trend !== null && (
                          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: trendColor, fontWeight: 600 }}>
                            {trendIcon} {Math.abs(item.trend)}%
                          </div>
                        )}
                        <div style={{ width: 80, height: 6, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${item.avg}%`, background: pctColor(item.avg), borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: pctColor(item.avg), minWidth: 44, textAlign: "right" }}>{item.avg}%</div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>{icon} {title} · {rankings.length} TOTAL</div>
                    <div style={{ display: "grid", gridTemplateColumns: bottom.length > 0 ? "1fr 1fr" : "1fr", gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.green, letterSpacing: "0.08em", marginBottom: 10 }}>TOP PERFORMERS</div>
                        {top.map((item, i) => <Row key={item.name} item={item} rank={i} showMedal={true} />)}
                      </div>
                      {bottom.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.red, letterSpacing: "0.08em", marginBottom: 10 }}>NEEDS ATTENTION</div>
                          {bottom.map((item, i) => <Row key={item.name} item={item} rank={i} showMedal={false} />)}
                        </div>
                      )}
                    </div>
                    {rankings.length > 1 && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>SPREAD</div>
                        <div style={{ flex: 1, height: 6, background: C.surfaceAlt, borderRadius: 3, position: "relative" }}>
                          <div style={{ position: "absolute", left: `${rankings[rankings.length-1].avg}%`, right: `${100 - rankings[0].avg}%`, top: 0, height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.green})`, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>
                          <span style={{ color: C.red }}>{rankings[rankings.length-1].avg}%</span>
                          <span style={{ margin: "0 6px" }}>→</span>
                          <span style={{ color: C.green }}>{rankings[0].avg}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Legend */}
                  <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "10px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>TREND (vs previous 3 sessions):</span>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.green }}>▲ Improving</span>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.red }}>▼ Declining</span>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint }}>– Insufficient data</span>
                  </div>
                  <RankingTable title="HOSPITALS" icon="🏥" rankings={hospitalRankings} />
                  <RankingTable title="LOCATIONS / UNITS" icon="📍" rankings={locationRankings} />
                </div>
              );
            })()}
          </div>
        )}

        {tab === "admin" && isAdmin && (
          <div>
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>Admin Dashboard</h1>
                <p style={{ color: C.inkMid, fontSize: 13 }}>Full visibility across all users, sessions, and hospitals.</p>
              </div>
              <button onClick={() => setShowBrandingEditor(true)}
                style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 8, padding: "10px 18px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", letterSpacing: "0.05em" }}>
                🎨 HOSPITAL BRANDING
              </button>
            </div>

            {/* Admin sub-nav */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 24, gap: 0 }}>
              {[["sessions","ALL SESSIONS"],["users","USER MANAGEMENT"],["audit","AUDIT LOG"]].map(([id, label]) => (
                <button key={id} onClick={() => setAdminSection(id)}
                  style={{ padding: "8px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: adminSection === id ? C.primary : C.inkLight, borderBottom: adminSection === id ? `2px solid ${C.primary}` : "2px solid transparent", transition: "all 0.15s" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Stats row - always visible */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Sessions", value: allEntriesFull.length },
                { label: "Hospitals", value: [...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].length },
                { label: "Active Users", value: userProfiles.filter(u => u.is_active !== false).length },
                { label: "Avg Overall", value: (() => { const vals = METRICS.flatMap(m => allEntriesFull.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null)); return vals.length ? `${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}%` : "—"; })() },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: C.inkLight, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 32, fontWeight: 700, color: C.primary }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* ── SESSIONS SECTION ── */}
            {adminSection === "sessions" && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em" }}>ALL SESSIONS ({allEntriesFull.length})</div>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete ALL ${allEntriesFull.length} sessions? This cannot be undone.`)) return;
                      const ids = allEntriesFull.map(e => e.id);
                      const { error } = await supabase.from("sessions").delete().in("id", ids);
                      if (error) { alert("Failed: " + error.message); return; }
                      await logAudit("ALL_SESSIONS_DELETED", { count: ids.length });
                      setAllEntriesFull([]); setEntries([]);
                    }}
                    style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer", letterSpacing: "0.05em" }}>
                    DELETE ALL SESSIONS
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...allEntriesFull].reverse().map(e => {
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
                        <button onClick={() => handleDelete(e.id)}
                          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer" }}
                          onMouseEnter={el => { el.target.style.background = C.redLight; el.target.style.borderColor = C.red; }}
                          onMouseLeave={el => { el.target.style.background = "none"; el.target.style.borderColor = C.border; }}>
                          DELETE
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── USER MANAGEMENT SECTION ── */}
            {adminSection === "users" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Per-user breakdown */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>ALL USERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {userProfiles.map(profile => {
                      const userSessions = allEntriesFull.filter(e => e.logged_by === profile.full_name || e.logged_by === profile.email);
                      const overallVals = METRICS.flatMap(m => userSessions.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                      const overall = overallVals.length ? Math.round(overallVals.reduce((a,b)=>a+b,0)/overallVals.length) : null;
                      const lastSession = userSessions[userSessions.length - 1];
                      const isActive = profile.is_active !== false;
                      const isAdminUser = ADMIN_EMAILS.includes(profile.email);
                      return (
                        <div key={profile.id} style={{ background: isActive ? C.bg : C.redLight, borderRadius: 10, padding: "14px 16px", border: `1px solid ${isActive ? C.border : "#f0c8c8"}`, opacity: isActive ? 1 : 0.7 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: isAdminUser ? C.accentLight : C.primaryLight, border: `1px solid ${isAdminUser ? C.accent : C.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: isAdminUser ? C.accent : C.primary, flexShrink: 0 }}>
                              {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{profile.full_name || profile.email}</div>
                                {isAdminUser && <span style={{ fontSize: 9, background: C.accentLight, color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>ADMIN</span>}
                                {!isActive && <span style={{ fontSize: 9, background: C.redLight, color: C.red, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>DEACTIVATED</span>}
                              </div>
                              <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>
                                {profile.email} · {userSessions.length} session{userSessions.length !== 1 ? "s" : ""}
                                {lastSession && ` · Last: ${formatTimestamp(lastSession.created_at, lastSession.date)}`}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", marginRight: 8 }}>
                              <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: overall !== null ? pctColor(overall) : C.inkFaint }}>{overall !== null ? `${overall}%` : "—"}</div>
                              <div style={{ fontSize: 10, color: C.inkLight }}>avg compliance</div>
                            </div>
                            {!isAdminUser && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <button onClick={async () => {
                                    const newStatus = !isActive;
                                    const { error } = await supabase.from("user_profiles").update({ is_active: newStatus, deactivated_at: newStatus ? null : new Date().toISOString(), deactivated_by: newStatus ? null : (user?.user_metadata?.full_name || user?.email) }).eq("id", profile.id);
                                    if (error) { alert("Failed: " + error.message); return; }
                                    setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_active: newStatus } : p));
                                    await logAudit(newStatus ? "USER_REACTIVATED" : "USER_DEACTIVATED", { email: profile.email, name: profile.full_name }, profile.email);
                                    const { data: freshAudit } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
                                    if (freshAudit) setAuditLog(freshAudit);
                                  }}
                                  style={{ background: isActive ? C.redLight : C.greenLight, border: `1px solid ${isActive ? C.red : C.green}44`, borderRadius: 6, padding: "4px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: isActive ? C.red : C.green, cursor: "pointer", whiteSpace: "nowrap" }}>
                                  {isActive ? "DEACTIVATE" : "REACTIVATE"}
                                </button>
                                <button onClick={async () => {
                                    if (!window.confirm(`Send password reset email to ${profile.email}?`)) return;
                                    const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
                                    if (error) { alert("Failed: " + error.message); return; }
                                    await logAudit("PASSWORD_RESET_SENT", { email: profile.email }, profile.email);
                                    alert(`Password reset email sent to ${profile.email}`);
                                  }}
                                  style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "4px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", whiteSpace: "nowrap" }}>
                                  RESET PASSWORD
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {userProfiles.length === 0 && <div style={{ fontSize: 13, color: C.inkLight, padding: "20px 0" }}>No users registered yet.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── AUDIT LOG SECTION ── */}
            {adminSection === "audit" && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>AUDIT LOG · {auditLog.length} EVENTS</div>
                {auditLog.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.inkLight, padding: "20px 0" }}>No audit events recorded yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {auditLog.map(log => {
                      const actionColors = {
                        SESSION_CREATED: C.green, SESSION_EDITED: C.amber, SESSION_DELETED: C.red,
                        USER_DEACTIVATED: C.red, USER_REACTIVATED: C.green, PASSWORD_RESET_SENT: C.primary,
                        ALL_SESSIONS_DELETED: C.red,
                      };
                      const actionLabels = {
                        SESSION_CREATED: "Session Created", SESSION_EDITED: "Session Edited",
                        SESSION_DELETED: "Session Deleted", USER_DEACTIVATED: "User Deactivated",
                        USER_REACTIVATED: "User Reactivated", PASSWORD_RESET_SENT: "Password Reset Sent",
                        ALL_SESSIONS_DELETED: "All Sessions Deleted",
                      };
                      const color = actionColors[log.action] || C.inkLight;
                      const label = actionLabels[log.action] || log.action;
                      const details = log.details || {};
                      return (
                        <div key={log.id} style={{ display: "flex", gap: 12, padding: "10px 14px", background: C.bg, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                              {details.hospital && <span style={{ fontSize: 11, color: C.inkMid }}>· {details.hospital}</span>}
                              {details.date && <span style={{ fontSize: 11, color: C.inkLight }}>· {details.date}</span>}
                              {log.target_user && <span style={{ fontSize: 11, background: C.primaryLight, color: C.primary, borderRadius: 10, padding: "1px 8px" }}>{log.target_user}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: C.inkLight, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                              by {log.performed_by} · {formatTimestamp(log.created_at)}
                            </div>
                            {log.action === "SESSION_EDITED" && details.changed && Object.keys(details.changed).length > 0 && (
                              <div style={{ marginTop: 6, fontSize: 11, color: C.inkLight }}>
                                Changed: {Object.entries(details.changed).map(([k, v]) => (
                                  <span key={k} style={{ marginRight: 8, background: C.amberLight, borderRadius: 4, padding: "1px 6px", color: C.amber }}>
                                    {k}: "{String(v.from)}" → "{String(v.to)}"
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* ── ONBOARDING MODAL ───────────────────────────────────────────────── */}
      {showOnboarding && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.surface, borderRadius: 16, maxWidth: 520, width: "100%", padding: "36px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {onboardingStep === 0 && (
              <>
                <div style={{ fontSize: 36, marginBottom: 16 }}>👋</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 24, fontWeight: 400, marginBottom: 12 }}>Welcome to CareTrack</h2>
                <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, marginBottom: 20 }}>CareTrack helps you track wound care compliance across hospitals and locations. Log sessions after each visit, view trends on your dashboard, and export reports for your team.</p>
                <div style={{ background: C.bg, borderRadius: 10, padding: "16px 20px", marginBottom: 24, fontSize: 13, color: C.inkMid, lineHeight: 1.8 }}>
                  <div>📋 <strong>Log Session</strong> — Record compliance data after each visit</div>
                  <div>📊 <strong>Dashboard</strong> — View trends and national averages</div>
                  <div>📁 <strong>History</strong> — Browse and edit past sessions</div>
                  <div>🏆 <strong>Performers</strong> — See hospital and location rankings</div>
                </div>
                <button onClick={() => setOnboardingStep(1)} style={{ width: "100%", background: C.primary, border: "none", borderRadius: 8, padding: "14px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.08em" }}>
                  GET STARTED →
                </button>
              </>
            )}
            {onboardingStep === 1 && (
              <>
                <div style={{ fontSize: 36, marginBottom: 16 }}>⌨️</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 24, fontWeight: 400, marginBottom: 12 }}>Keyboard Shortcuts</h2>
                <p style={{ fontSize: 14, color: C.inkMid, marginBottom: 20 }}>Navigate CareTrack faster with these shortcuts:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                  {[["1","Log Session"],["2","Dashboard"],["3","History"],["4","Performers"],["5","Admin (admins only)"],["?","What's New / Changelog"],["Esc","Close any modal"]].map(([key, desc]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
                      <kbd style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.ink, minWidth: 36, textAlign: "center" }}>{key}</kbd>
                      <span style={{ fontSize: 13, color: C.inkMid }}>{desc}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setOnboardingStep(0)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>← BACK</button>
                  <button onClick={() => { setOnboardingStep(2); }} style={{ flex: 2, background: C.primary, border: "none", borderRadius: 8, padding: "12px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em" }}>NEXT →</button>
                </div>
              </>
            )}
            {onboardingStep === 2 && (
              <>
                <div style={{ fontSize: 36, marginBottom: 16 }}>✅</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 24, fontWeight: 400, marginBottom: 12 }}>You're all set!</h2>
                <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, marginBottom: 20 }}>Start by logging your first session — tap <strong>Log Session</strong> and fill in your hospital, location, and metric data. Your dashboard will populate as you add more sessions.</p>
                <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 24 }}>You can revisit this guide anytime from the <strong>What's New</strong> button in the top bar.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setOnboardingStep(1)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>← BACK</button>
                  <button onClick={() => { setShowOnboarding(false); localStorage.setItem("caretrack_onboarded", "true"); setTab("log"); }} style={{ flex: 2, background: C.primary, border: "none", borderRadius: 8, padding: "12px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em" }}>START LOGGING →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHANGELOG MODAL ────────────────────────────────────────────────── */}
      {showChangelog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowChangelog(false)}>
          <div style={{ background: C.surface, borderRadius: 16, maxWidth: 540, width: "100%", padding: "36px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 24, fontWeight: 400 }}>What's New</h2>
              <button onClick={() => setShowChangelog(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.inkLight }}>✕</button>
            </div>
            {[
              { version: "2.0", date: "February 2026", badge: "LATEST", items: [
                "Excel export with Summary and Raw Sessions sheets",
                "White-label branding per hospital (logo + color theme)",
                "Onboarding flow for new users",
                "In-app changelog (you're reading it!)",
                "Keyboard shortcuts for quick navigation",
                "PWA support — install CareTrack as a mobile app",
                "Photo attachments on sessions (up to 3 per session)",
                "Month-over-month comparison card on dashboard",
                "Performers tab with hospital and location rankings",
                "National average benchmarks on metric cards and chart",
                "Offline mode with automatic sync on reconnect",
                "Audit log — tracks all creates, edits, and deletes",
                "User management — deactivate, reactivate, reset passwords",
              ]},
              { version: "1.5", date: "January 2026", badge: null, items: [
                "Inline session editing from History tab",
                "Required field validation on Log Session form",
                "Duplicate session warnings",
                "Export filenames now include hospital name",
                "Session notes included in PDF and PPTX exports",
                "Second admin account added",
                "Admin can delete individual sessions or all sessions",
              ]},
              { version: "1.0", date: "December 2025", badge: null, items: [
                "Initial release — session logging, dashboard, history",
                "PDF and PowerPoint export",
                "AI clinical summary",
                "Date range filtering",
                "Multi-hospital support",
                "User authentication",
              ]},
            ].map(release => (
              <div key={release.version} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: C.ink }}>v{release.version}</div>
                  <div style={{ fontSize: 11, color: C.inkLight }}>{release.date}</div>
                  {release.badge && <span style={{ background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 10, padding: "1px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}>{release.badge}</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {release.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: C.inkMid }}>
                      <span style={{ color: C.primary, flexShrink: 0 }}>✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => { setShowChangelog(false); setShowOnboarding(true); setOnboardingStep(0); }} style={{ width: "100%", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", marginTop: 8 }}>
              REPLAY ONBOARDING TOUR
            </button>
          </div>
        </div>
      )}

      {/* ── WHITE-LABEL BRANDING EDITOR (ADMIN ONLY) ───────────────────────── */}
      {showBrandingEditor && isAdmin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowBrandingEditor(false)}>
          <div style={{ background: C.surface, borderRadius: 16, maxWidth: 480, width: "100%", padding: "36px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400 }}>Hospital Branding</h2>
              <button onClick={() => setShowBrandingEditor(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.inkLight }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 20 }}>Customize the logo and accent color shown when a specific hospital is filtered. Affects dashboard header and exports.</p>
            {[...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort().map(hospital => {
              const b = hospitalBranding[hospital] || {};
              return (
                <div key={hospital} style={{ marginBottom: 20, padding: "16px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 12 }}>{hospital}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                    <div>
                      <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>LOGO URL</label>
                      <input type="text" placeholder="https://example.com/logo.png" defaultValue={b.logoUrl || ""}
                        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: C.ink, outline: "none" }}
                        onChange={ev => setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], logoUrl: ev.target.value } }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>COLOR</label>
                      <input type="color" defaultValue={b.accentColor || "#4a6f7a"}
                        style={{ width: 44, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, cursor: "pointer", padding: 2 }}
                        onChange={ev => setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], accentColor: ev.target.value } }))} />
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => {
              localStorage.setItem("caretrack_branding", JSON.stringify(hospitalBranding));
              setShowBrandingEditor(false);
              alert("Branding saved!");
            }} style={{ width: "100%", background: C.primary, border: "none", borderRadius: 8, padding: "14px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.08em" }}>
              SAVE BRANDING
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

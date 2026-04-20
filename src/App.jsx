// CareTrack v2.9
import { useState, useEffect, useRef, Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { generatePptx } from "./generatePptx";
import { generatePdf } from "./generatePdf";
import { generateXlsx } from "./generateXlsx";
import { MetricIcon } from "./MetricIcons";

const ADMIN_EMAILS = ["arobinson@hovertechinternational.com", "edoherty@hovertechinternational.com"];

const LIGHT = {
  bg: "#f5f3f1", surface: "#ffffff", surfaceAlt: "#DEDAD9", border: "#cec9c7", borderDark: "#b8b2af",
  ink: "#2a2624", inkMid: "#4F6E77", inkLight: "#7C7270", inkFaint: "#c0bbb9",
  primary: "#4F6E77", primaryLight: "#e8eff1", secondary: "#678093", secondaryLight: "#edf0f3",
  accent: "#7C5366", accentLight: "#f3eef1",
  green: "#3a7d5c", greenLight: "#e8f4ee", red: "#9e3a3a", redLight: "#fdf0f0",
  amber: "#8a6a2a", amberLight: "#fdf6e8",
};
const DARK = {
  bg: "#1a1e1f", surface: "#242a2b", surfaceAlt: "#2e3536", border: "#3a4244", borderDark: "#4a5558",
  ink: "#e8e4e2", inkMid: "#8ab0b8", inkLight: "#6a8e96", inkFaint: "#3a4a4e",
  primary: "#6a9aaa", primaryLight: "#1e3035", secondary: "#7a96a8", secondaryLight: "#1e2a30",
  accent: "#a07388", accentLight: "#2a1e24",
  green: "#4fa87a", greenLight: "#0e2a1c", red: "#c85858", redLight: "#2a0e0e",
  amber: "#b8903a", amberLight: "#2a1e08",
};

// C is set at runtime — components read from this object
let C = { ...LIGHT };

const METRICS = [
  { id: "turning_criteria", label: "Turning & Repositioning",desc: "Can patient tolerate Q2 turning?" },
  { id: "matt_applied",     label: "Matt Applied",           desc: "Is a matt under patient?" },
  { id: "matt_proper",      label: "Matt Applied Properly",  desc: "Is matt correctly positioned under patient?" },
  { id: "wedges_in_room",   label: "Wedges in Room",         desc: "Are there wedges in patient room?" },
  { id: "wedges_applied",   label: "Wedges Applied",         desc: "Were wedges being used to offload patient?" },
  { id: "wedge_offload",    label: "Proper Wedge Offloading",desc: "Were wedges properly placed under patient?" },
  { id: "air_supply",       label: "Air Supply in Room",     desc: "Was there an Air Supply in the patient room, if applicable?" },
];

const MAYO_METRICS = [
  { id: "air_reposition",   label: "Air Used to Reposition Patient", desc: "Rep observed or confirmed air is being used to reposition patient" },
];

const KAISER_METRICS = [
  { id: "heel_boots",       label: "Heel Boots On",                  desc: "Qualifying patients that had heel boots applied" },
  { id: "turn_clock",       label: "Turn Clock",                     desc: "Qualifying patients with Turn Clock compliance" },
];

const METRIC_BUCKETS = [
  { label: "Patient Met Criteria", ids: ["turning_criteria"] },
  { label: "Matt Compliance", ids: ["matt_applied", "matt_proper"] },
  { label: "Wedge Compliance", ids: ["wedges_in_room", "wedges_applied", "wedge_offload"] },
  { label: "Air Supply", ids: ["air_supply"] },
];
const MAYO_BUCKET   = { label: "Air Supply",      ids: ["air_supply", "air_reposition"] };
const KAISER_BUCKET = { label: "Kaiser Metrics", ids: ["heel_boots", "turn_clock"] };
const getBuckets = (hospital) => {
  let buckets = METRIC_BUCKETS.map(b => b.label === "Air Supply" && isMayo(hospital) ? MAYO_BUCKET : b);
  if (isKaiser(hospital)) buckets = [...buckets, KAISER_BUCKET];
  return buckets;
};

const isMayo   = (hospital) => hospital && hospital.toLowerCase().includes("mayo");
const isKaiser = (hospital) => hospital && hospital.toLowerCase().includes("kaiser");
const getMetrics = (hospital) => [
  ...METRICS,
  ...(isMayo(hospital)   ? MAYO_METRICS   : []),
  ...(isKaiser(hospital) ? KAISER_METRICS : []),
];

const defaultForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  hospital: "", protocol_for_use: "", location: "", notes: "",
  ...Object.fromEntries([...METRICS, ...MAYO_METRICS, ...KAISER_METRICS].flatMap(m => [[`${m.id}_num`, ""], [`${m.id}_den`, ""]]))
});

const pct = (n, d) => { const nv = parseFloat(n), dv = parseFloat(d); if (!dv || isNaN(nv) || isNaN(dv)) return null; return Math.round((nv / dv) * 100); };
const pctColor = (v) => { if (v === null) return C.inkLight; if (v >= 90) return C.green; if (v >= 70) return C.amber; return C.red; };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isInStandaloneMode = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
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
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("rep");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);

  const REGIONS = ["Northeast", "West", "Central", "Southeast"];

  const handleSubmit = async () => {
    setLoading(true); setError(""); setMessage("");
    if (mode === "signup") {
      if (!name.trim()) { setError("Please enter your full name."); setLoading(false); return; }
      if (!region) { setError("Please select your region."); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data?.user) {
        await supabase.from("user_profiles").upsert({
          id: data.user.id, email, full_name: name, role, region,
          is_active: false, pending_approval: true, created_at: new Date().toISOString(),
        });
        try {
          await fetch("https://okswecmkqegydbxsczjc.supabase.co/functions/v1/notify-admin-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, role, region }),
          });
        } catch (_) {}
      }
      setPendingApproval(true);
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) setError(error.message);
      else setMessage("Password reset email sent — check your inbox.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      const { data: profile } = await supabase.from("user_profiles").select("is_active, pending_approval").eq("email", email).single();
      if (profile?.pending_approval) {
        await supabase.auth.signOut();
        setError("Your account is pending admin approval. You'll receive an email once approved.");
      } else if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Please contact an administrator.");
      } else {
        // Update last login timestamp
        await supabase.from("user_profiles").update({ last_login: new Date().toISOString() }).eq("email", email);
        onLogin(data.user);
      }
    }
    setLoading(false);
  };

  const inp = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", fontSize: 14, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" };
  const sel = { ...inp, cursor: "pointer" };

  if (pendingApproval) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #e8eff1 0%, #f5f3f1 50%, #f3eef1 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <img src="/hovertech-logo.png" alt="HoverTech" style={{ height: 52, objectFit: "contain" }} />
          </div>
          <div style={{ background: C.surface, borderRadius: 16, padding: "36px", boxShadow: "0 4px 32px rgba(79,110,119,0.10)", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.amberLight, border: `1px solid ${C.amber}33`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>⏳</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.12em", marginBottom: 12 }}>PENDING APPROVAL</div>
            <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, color: C.ink, marginBottom: 12 }}>Account request submitted</h2>
            <p style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.6, marginBottom: 24 }}>
              Thanks {name.split(" ")[0]}! Your request has been sent to a CareTrack administrator. You'll receive an email at <strong>{email}</strong> once your account is activated.
            </p>
            <div style={{ background: C.bg, borderRadius: 8, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: C.inkLight, textAlign: "left" }}>
              <div style={{ marginBottom: 4 }}><strong style={{ color: C.ink }}>Role:</strong> {role.charAt(0).toUpperCase() + role.slice(1)}</div>
              <div><strong style={{ color: C.ink }}>Region:</strong> {region}</div>
            </div>
            <p style={{ fontSize: 12, color: C.inkFaint }}>Questions? Contact <strong>Elizabeth Doherty</strong><br />
              <a href="mailto:edoherty@hovertechinternational.com" style={{ color: C.primary }}>edoherty@hovertechinternational.com</a>
            </p>
          </div>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>CARETRACK · WOUND CARE COMPLIANCE</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #e8eff1 0%, #f5f3f1 50%, #f3eef1 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/hovertech-logo.png" alt="HoverTech" style={{ height: 52, objectFit: "contain" }} />
        </div>
        <div style={{ background: C.surface, borderRadius: 16, padding: "36px", boxShadow: "0 4px 32px rgba(79,110,119,0.10)" }}>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, color: C.ink, marginBottom: 4 }}>
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Request access" : "Reset password"}
          </h2>
          <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 28 }}>
            {mode === "login" ? "Sign in to CareTrack" : mode === "signup" ? "Submit your details for admin approval" : "Enter your email and we'll send a reset link"}
          </p>
          {error && <div style={{ background: C.redLight, border: `1px solid #f0c8c8`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 20 }}>⚠ {error}</div>}
          {message && <div style={{ background: C.greenLight, border: `1px solid #b8dfc9`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.green, marginBottom: 20 }}>✓ {message}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && (<>
              <div>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>FULL NAME</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>ROLE</label>
                  <select value={role} onChange={e => setRole(e.target.value)} style={sel}>
                    <option value="rep">Sales Rep</option>
                    <option value="kam">KAM</option>
                    <option value="director">Director</option>
                    <option value="vp">VP</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>REGION</label>
                  <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...sel, color: region ? C.ink : C.inkLight }}>
                    <option value="">Select...</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </>)}
            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@hovertechinternational.com" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            {mode !== "forgot" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>PASSWORD</label>
                  {mode === "login" && (
                    <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>FORGOT PASSWORD?</button>
                  )}
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              </div>
            )}
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 24, background: C.primary, border: "none", borderRadius: 8, padding: "13px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: "white", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "PLEASE WAIT..." : mode === "login" ? "SIGN IN →" : mode === "signup" ? "REQUEST ACCESS →" : "SEND RESET EMAIL →"}
          </button>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.inkLight }}>
            {mode === "login" && <span>Need access? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Request an account</button></span>}
            {mode === "signup" && <span>Already have an account? <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Sign in</button></span>}
            {mode === "forgot" && <span>Remember it? <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={{ background: "none", border: "none", color: C.primary, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Back to sign in</button></span>}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>CARETRACK · WOUND CARE COMPLIANCE</div>
      </div>
    </div>
  );
};

  const handleSubmit = async () => {
    setLoading(true); setError(""); setMessage("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) setError(error.message);
      else { setMessage("Account created! Check your email to confirm, then log in."); setMode("login"); }
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) setError(error.message);
      else setMessage("Password reset email sent — check your inbox.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); }
      else {
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

const PasswordResetScreen = ({ onComplete }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => onComplete(), 2000);
  };

  const inp = { width: "100%", background: "#ffffff", border: `1px solid #cec9c7`, borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "#2a2624", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #e8eff1 0%, #f5f3f1 50%, #f3eef1 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/hovertech-logo.png" alt="HoverTech" style={{ height: 52, objectFit: "contain" }} />
        </div>
        <div style={{ background: "#ffffff", borderRadius: 16, padding: "36px", boxShadow: "0 4px 32px rgba(79,110,119,0.10)" }}>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, color: "#2a2624", marginBottom: 4 }}>Set new password</h2>
          <p style={{ fontSize: 13, color: "#7C7270", marginBottom: 28 }}>Choose a strong password for your CareTrack account.</p>
          {error && <div style={{ background: "#fdf0f0", border: "1px solid #f0c8c8", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#9e3a3a", marginBottom: 20 }}>⚠ {error}</div>}
          {done && <div style={{ background: "#e8f4ee", border: "1px solid #b8dfc9", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#3a7d5c", marginBottom: 20 }}>✓ Password updated — signing you in...</div>}
          {!done && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#7C7270", letterSpacing: "0.08em", marginBottom: 6 }}>NEW PASSWORD</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" style={inp}
                  onFocus={e => e.target.style.borderColor = "#4F6E77"} onBlur={e => e.target.style.borderColor = "#cec9c7"} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#7C7270", letterSpacing: "0.08em", marginBottom: 6 }}>CONFIRM PASSWORD</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your new password" style={inp}
                  onFocus={e => e.target.style.borderColor = "#4F6E77"} onBlur={e => e.target.style.borderColor = "#cec9c7"}
                  onKeyDown={e => e.key === "Enter" && handleReset()} />
              </div>
              <button onClick={handleReset} disabled={loading} style={{ width: "100%", marginTop: 8, background: "#4F6E77", border: "none", borderRadius: 8, padding: "13px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: "white", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "SAVING..." : "SET PASSWORD →"}
              </button>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#c0bbb9", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>CARETRACK · WOUND CARE COMPLIANCE</div>
      </div>
    </div>
  );
};


const MetricInput = ({ metric, num, den, onChange }) => {
  const isNA = num === "na" && den === "na";
  const p = isNA ? null : pct(num, den);
  return (
    <div style={{ background: isNA ? C.surfaceAlt : C.surface, border: `1px solid ${isNA ? C.border : C.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, opacity: isNA ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: "'Libre Baskerville', serif" }}>{metric.label}</div>
          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>{metric.desc}</div>
        </div>
        <button
          onClick={() => { isNA ? (onChange("num", ""), onChange("den", "")) : (onChange("num", "na"), onChange("den", "na")); }}
          style={{ flexShrink: 0, marginLeft: 12, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${isNA ? C.primary : C.border}`, background: isNA ? C.primary : "none", color: isNA ? "white" : C.inkLight }}>
          N/A
        </button>
      </div>
      {!isNA && (
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
      )}
      {isNA && (
        <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.05em" }}>NOT APPLICABLE — excluded from calculations</div>
      )}
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

// ── Bed-Level Grid Input ──────────────────────────────────────────────────────
const METRIC_SHORT = {
  matt_applied: "Matt App", wedges_applied: "Wedges App", turning_criteria: "Turn & Repo",
  matt_proper: "Matt Proper", wedges_in_room: "Wedge Room", wedge_offload: "Wedge Off",
  air_supply: "Air Supply", air_reposition: "Air Repo",
};

const createEmptyBed = (metrics, roomNum) => {
  const bed = { room: roomNum !== undefined && roomNum !== null ? String(roomNum) : "", na: false };
  metrics.forEach(m => { bed[`${m.id}_q`] = "0"; bed[`${m.id}_a`] = "0"; bed[`${m.id}_na`] = false; });
  return bed;
};

const BedGrid = ({ metrics, beds, onChange, onAddBed, onRemoveBed, hospital = "" }) => {
  const [activeBed, setActiveBed] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState(""); // "", "starting", "ready", "reading", "error"
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Keep activeBed in bounds if beds shrink
  const safeIdx = Math.min(activeBed, beds.length - 1);
  useEffect(() => { if (safeIdx !== activeBed) setActiveBed(safeIdx); }, [beds.length]);

  const updateCell = (field, value) => {
    const updated = beds.map((b, i) => i === safeIdx ? { ...b, [field]: value } : b);
    onChange(updated);
  };

  const goTo = (idx) => setActiveBed(Math.max(0, Math.min(idx, beds.length - 1)));

  const addAndGo = () => { onAddBed(); setActiveBed(beds.length); };

  const toggleNa = () => {
    const updated = beds.map((b, i) => i === safeIdx ? { ...b, na: !b.na } : b);
    onChange(updated);
  };

  // Per-metric totals — eligible bed count as denominator, YES taps as numerator
  const totals = {};
  const activeBeds = beds.filter(b => !b.na);
  metrics.forEach(m => {
    const eligible = activeBeds.filter(b => !b[`${m.id}_na`]);
    totals[`${m.id}_q`] = eligible.length;
    totals[`${m.id}_a`] = eligible.reduce((s, b) => s + (b[`${m.id}_a`] === '1' || b[`${m.id}_a`] === 1 ? 1 : 0), 0);
  });

  const openCamera = async () => {
    setScanning(true);
    setScanStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setScanStatus("ready");
      // Attach stream to video element after modal renders
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      setScanStatus("error");
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
    setScanStatus("");
  };

  const captureAndRead = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanStatus("reading");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    try {
      // Load Tesseract from CDN if not already loaded
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const { data: { text } } = await window.Tesseract.recognize(canvas, "eng", {
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz- ",
      });
      // Extract the most prominent number/room from OCR result
      const cleaned = text.trim().replace(/\n+/g, " ");
      // Look for patterns like "3997", "Room 12", "3N", "4 South", etc.
      const roomMatch = cleaned.match(/\b(\d{3,4}[A-Za-z]?|[A-Za-z]+[\s-]?\d+|\d+[A-Za-z]{1,2})\b/);
      const result = roomMatch ? roomMatch[1] : cleaned.replace(/[^0-9A-Za-z\s-]/g, "").trim().slice(0, 10);
      if (result) {
        updateCell("room", result);
        closeCamera();
      } else {
        setScanStatus("ready"); // no match — let them try again
      }
    } catch {
      setScanStatus("ready");
    }
  };

  const bed = beds[safeIdx] || {};
  const isNa = !!bed.na;

  // Compliance colour for a pct value
  const pctCol = (p) => p === null ? C.inkFaint : p >= 90 ? C.green : p >= 70 ? C.amber : C.red;
  const pctBg2 = (p) => p === null ? C.surfaceAlt : p >= 90 ? C.greenLight : p >= 70 ? C.amberLight : C.redLight;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Navigation bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => goTo(safeIdx - 1)} disabled={safeIdx === 0}
          style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, cursor: safeIdx === 0 ? "not-allowed" : "pointer", color: safeIdx === 0 ? C.inkFaint : C.primary, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          ‹
        </button>

        {/* Progress dots */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          {beds.map((b, i) => (
            <button key={i} onClick={() => goTo(i)}
              style={{ width: i === safeIdx ? 24 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: i === safeIdx ? C.primary : b.na ? C.amber : C.border, transition: "all 0.2s", padding: 0, flexShrink: 0 }} />
          ))}
        </div>

        <button onClick={() => goTo(safeIdx + 1)} disabled={safeIdx === beds.length - 1}
          style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, cursor: safeIdx === beds.length - 1 ? "not-allowed" : "pointer", color: safeIdx === beds.length - 1 ? C.inkFaint : C.primary, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          ›
        </button>
      </div>

      {/* ── Bed card ── */}
      <div style={{ background: C.surface, border: `1px solid ${isNa ? C.border : C.primary + "44"}`, borderRadius: 14, overflow: "hidden", opacity: isNa ? 0.6 : 1, transition: "opacity 0.2s" }}>

        {/* Card header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: C.primaryLight, borderBottom: `1px solid ${C.primary}22` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, letterSpacing: "0.08em" }}>ROOM / BED</span>
            <input type="text" value={bed.room || ""} placeholder={String(safeIdx + 1)}
              onChange={e => updateCell("room", e.target.value)}
              style={{ width: 80, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: C.primary, outline: "none" }}
              onFocus={e => { e.target.style.borderColor = C.primary; if (!bed.room) updateCell("room", String(safeIdx + 1)); }}
              onBlur={e => e.target.style.borderColor = C.border} />
            <button onClick={openCamera} title="Scan room number"
              style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, padding: 0, flexShrink: 0 }}>
              📷
            </button>
            <button onClick={toggleNa}
              style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${isNa ? C.amber : C.border}`, background: isNa ? C.amberLight : "none", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: isNa ? C.amber : C.inkLight, cursor: "pointer", letterSpacing: "0.05em", fontWeight: isNa ? 700 : 400, transition: "all 0.15s" }}>
              {isNa ? "✓ N/A" : "N/A"}
            </button>
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.06em" }}>{safeIdx + 1} of {beds.length}</span>
        </div>

        {/* Metric rows — checkbox mode */}
        <div style={{ padding: "8px 16px 16px" }}>
          {metrics.map((m, mi) => {
            const metricNa = !!bed[`${m.id}_na`];
            const rawQ = bed[`${m.id}_q`];
            const rawA = bed[`${m.id}_a`];
            // Two states: compliant (a=1) or non-compliant (a=0, default)
            const compliant = rawA === "1" || rawA === 1;

            const toggleCompliant = () => {
              if (metricNa) return;
              updateCell(`${m.id}_q`, "1");
              updateCell(`${m.id}_a`, compliant ? "0" : "1");
            };

            const btnBg     = metricNa ? C.surfaceAlt : compliant ? C.greenLight : C.redLight;
            const btnBorder = metricNa ? C.border : compliant ? C.green + "66" : C.red + "66";
            const btnColor  = metricNa ? C.inkFaint : compliant ? C.green : C.red;
            const btnIcon   = compliant ? "✓" : "✗";
            const btnLabel  = compliant ? "YES" : "NO";

            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: mi < metrics.length - 1 ? `1px solid ${C.border}` : "none", opacity: metricNa ? 0.4 : 1, transition: "opacity 0.15s" }}>
                {/* Metric name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{m.label}</div>
                  {m.desc && <div style={{ fontSize: 10, color: C.inkLight, marginTop: 1 }}>{m.desc}</div>}
                </div>

                {/* Big tap checkbox button */}
                <button onClick={toggleCompliant} disabled={metricNa}
                  style={{ flexShrink: 0, width: 72, height: 56, borderRadius: 10, border: `2px solid ${btnBorder}`, background: btnBg, cursor: metricNa ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}>
                  <span style={{ fontSize: 22, lineHeight: 1, color: btnColor, fontWeight: 700 }}>{btnIcon}</span>
                  <span style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em", color: btnColor, fontWeight: 700 }}>{btnLabel}</span>
                </button>

                {/* N/A toggle */}
                <button onClick={() => updateCell(`${m.id}_na`, !metricNa)}
                  style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, border: `1px solid ${metricNa ? C.amber : C.border}`, background: metricNa ? C.amberLight : "none", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: metricNa ? 700 : 400, color: metricNa ? C.amber : C.inkFaint, cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.04em" }}>
                  N/A
                </button>
              </div>
            );
          })}
        </div>

        {/* Card footer — actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => goTo(safeIdx - 1)} disabled={safeIdx === 0}
              style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: safeIdx === 0 ? C.inkFaint : C.inkMid, cursor: safeIdx === 0 ? "not-allowed" : "pointer", letterSpacing: "0.04em" }}>
              ← PREV
            </button>
            {safeIdx < beds.length - 1 ? (
              <button onClick={() => goTo(safeIdx + 1)}
                style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: C.primary, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.04em" }}>
                NEXT →
              </button>
            ) : (
              <button onClick={addAndGo}
                style={{ padding: "7px 16px", borderRadius: 8, border: `1px dashed ${C.primary}`, background: C.primaryLight, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", letterSpacing: "0.04em" }}>
                + ADD BED
              </button>
            )}
          </div>
          {beds.length > 1 && (
            <button onClick={() => {
              if (!window.confirm(`Delete Bed ${safeIdx + 1}${beds[safeIdx]?.room ? ` (${beds[safeIdx].room})` : ""}? This cannot be undone.`)) return;
              onRemoveBed(safeIdx);
              goTo(Math.max(0, safeIdx - 1));
            }}
              style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.red}44`, background: C.redLight, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer", letterSpacing: "0.04em" }}>
              DELETE BED
            </button>
          )}
        </div>
      </div>

      {/* ── Totals summary strip — grouped by bucket ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, letterSpacing: "0.1em", fontWeight: 600 }}>ALL BEDS — TOTALS</div>
          {beds.some(b => b.na) && <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.amber, letterSpacing: "0.06em" }}>{beds.filter(b => b.na).length} N/A EXCLUDED</div>}
        </div>
        {getBuckets(hospital).map(bucket => {
          const bucketMetrics = metrics.filter(m => bucket.ids.includes(m.id));
          if (bucketMetrics.length === 0) return null;
          return (
            <div key={bucket.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>{bucket.label.toUpperCase()}</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(bucketMetrics.length, 4)}, 1fr)`, gap: 8 }}>
                {bucketMetrics.map(m => {
                  const q = totals[`${m.id}_q`];
                  const a = totals[`${m.id}_a`];
                  const p = q > 0 ? Math.round((a / q) * 100) : null;
                  return (
                    <div key={m.id} style={{ background: p !== null ? pctBg2(p) : C.bg, border: `1px solid ${p !== null ? pctCol(p) + "33" : C.border}`, borderRadius: 8, padding: "7px 12px" }}>
                      <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginBottom: 4, lineHeight: 1.3 }}>{METRIC_SHORT[m.id] || m.label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 15, fontWeight: 700, color: p !== null ? pctCol(p) : C.inkFaint }}>
                          {p !== null ? `${p}%` : "—"}
                        </span>
                        {q > 0 && <span style={{ fontSize: 10, color: C.inkLight }}>{a}/{q}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Camera scan modal ── */}
      {scanning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 440, background: C.surface, borderRadius: "20px 20px 0 0", position: "absolute", bottom: 0, padding: "20px 20px 36px" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Scan Room Number</div>
                <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>Point camera at the room placard</div>
              </div>
              <button onClick={closeCamera} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: C.inkLight, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Viewfinder */}
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "4/3", marginBottom: 16 }}>
              {scanStatus === "starting" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13 }}>Starting camera...</div>
              )}
              {scanStatus === "error" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20 }}>
                  <span style={{ fontSize: 28 }}>🚫</span>
                  <div style={{ color: "white", fontSize: 13, textAlign: "center" }}>Camera access denied. Please allow camera permission in your browser settings.</div>
                </div>
              )}
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: "100%", height: "100%", objectFit: "cover", display: scanStatus === "error" ? "none" : "block" }} />
              {/* Targeting overlay */}
              {(scanStatus === "ready" || scanStatus === "reading") && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: "60%", height: "35%", border: `2px solid ${C.primary}`, borderRadius: 8, boxShadow: `0 0 0 2000px rgba(0,0,0,0.35)` }} />
                </div>
              )}
              {scanStatus === "reading" && (
                <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center" }}>
                  <span style={{ background: "rgba(0,0,0,0.7)", color: "white", fontSize: 12, padding: "4px 12px", borderRadius: 20, fontFamily: "'IBM Plex Mono', monospace" }}>Reading...</span>
                </div>
              )}
            </div>

            {/* Hidden canvas for OCR */}
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Capture button */}
            {(scanStatus === "ready" || scanStatus === "reading") && (
              <button onClick={captureAndRead} disabled={scanStatus === "reading"}
                style={{ width: "100%", padding: "14px", background: scanStatus === "reading" ? C.surfaceAlt : C.primary, border: "none", borderRadius: 10, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: scanStatus === "reading" ? C.inkLight : "white", cursor: scanStatus === "reading" ? "not-allowed" : "pointer", letterSpacing: "0.08em" }}>
                {scanStatus === "reading" ? "READING ROOM NUMBER..." : "📷  CAPTURE"}
              </button>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

const HospitalInput = ({ value, onChange, hospitals, entries = [] }) => {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const lastVisited = (hospital) => {
    const sessions = entries.filter(e => e.hospital === hospital && e.date);
    if (!sessions.length) return null;
    const latest = sessions.map(e => e.date).sort().reverse()[0];
    const days = Math.floor((new Date() - new Date(latest)) / 86400000);
    return days;
  };

  const dayLabel = (days) => {
    if (days === 0) return { text: "today", color: C.green };
    if (days === 1) return { text: "yesterday", color: C.green };
    if (days <= 19) return { text: `${days}d ago`, color: C.green };
    if (days <= 30) return { text: `${days}d ago`, color: C.amber };
    return { text: `${days}d ago`, color: C.red };
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>HOSPITAL NAME <span style={{ color: C.red }}>*</span></label>
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
          {filtered.map(h => {
            const days = lastVisited(h);
            const dl = days !== null ? dayLabel(days) : null;
            return (
              <div key={h} onClick={() => { onChange(h); setOpen(false); }}
                style={{ padding: "10px 14px", fontSize: 14, color: C.ink, cursor: "pointer", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span>{h}</span>
                {dl && <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: dl.color, letterSpacing: "0.05em", flexShrink: 0, marginLeft: 10 }}>{dl.text}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Hospital/Unit localStorage helpers ────────────────────────────────────────
const getHospitalData = () => {
  try { return JSON.parse(localStorage.getItem("caretrack_hospital_data") || "{}"); } catch { return {}; }
};
const saveHospitalData = (data) => {
  localStorage.setItem("caretrack_hospital_data", JSON.stringify(data));
};
const getUnitsForHospital = (hospital) => {
  if (!hospital) return [];
  const data = getHospitalData();
  return data[hospital]?.units || [];
};
const getProtocolForUnit = (hospital, unit) => {
  if (!hospital || !unit) return "";
  const data = getHospitalData();
  return data[hospital]?.protocols?.[unit] || "";
};
const saveHospitalUnit = (hospital, unit, protocol) => {
  if (!hospital || !unit) return;
  const data = getHospitalData();
  if (!data[hospital]) data[hospital] = { units: [], protocols: {} };
  if (!data[hospital].units.includes(unit)) data[hospital].units.push(unit);
  if (protocol) data[hospital].protocols[unit] = protocol;
  saveHospitalData(data);
};
const getBedCount = (hospital, unit) => {
  if (!hospital || !unit) return 0;
  const data = getHospitalData();
  return data[hospital]?.bedCounts?.[unit] || 0;
};
const saveBedCount = (hospital, unit, count) => {
  if (!hospital || !unit) return;
  const data = getHospitalData();
  if (!data[hospital]) data[hospital] = { units: [], protocols: {} };
  if (!data[hospital].bedCounts) data[hospital].bedCounts = {};
  data[hospital].bedCounts[unit] = count;
  saveHospitalData(data);
};
const getBedRooms = (hospital, unit) => {
  if (!hospital || !unit) return [];
  const data = getHospitalData();
  return data[hospital]?.bedRooms?.[unit] || [];
};
const saveBedRooms = (hospital, unit, rooms) => {
  if (!hospital || !unit) return;
  const data = getHospitalData();
  if (!data[hospital]) data[hospital] = { units: [], protocols: {} };
  if (!data[hospital].bedRooms) data[hospital].bedRooms = {};
  data[hospital].bedRooms[unit] = rooms;
  saveHospitalData(data);
};

// ── Unit Input (picklist from saved units for selected hospital) ──────────────
const UnitInput = ({ value, onChange, hospital }) => {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    setUnits(getUnitsForHospital(hospital));
  }, [hospital]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = units.filter(u => u.toLowerCase().includes(value.toLowerCase()) && u !== value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>LOCATION / UNIT <span style={{ color: C.red }}>*</span></label>
      <div style={{ position: "relative" }}>
        <input type="text" value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(units.length > 0)}
          placeholder="e.g. 3 North, ICU, 4 South"
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 36px 10px 12px", fontSize: 14, color: C.ink, outline: "none" }}
          onFocus={e => { e.target.style.borderColor = C.primary; setOpen(units.length > 0); }}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        {units.length > 0 && <button onClick={() => setOpen(o => !o)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.inkLight, fontSize: 12 }}>▾</button>}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 100, marginTop: 4, overflow: "hidden" }}>
          {filtered.map(u => (
            <div key={u} onClick={() => { onChange(u); setOpen(false); }}
              style={{ padding: "10px 14px", fontSize: 14, color: C.ink, cursor: "pointer", borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>{u}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Unit Manager ─────────────────────────────────────────────────────────────
const UnitManagerBody = ({ onClose }) => {
  const [data, setData] = useState(getHospitalData());
  const [editKey, setEditKey] = useState(null); // "hospital::unit"
  const [editVal, setEditVal] = useState("");

  const hospitals = Object.keys(data).sort();

  const renameUnit = (hospital, oldUnit, newUnit) => {
    if (!newUnit.trim() || newUnit === oldUnit) { setEditKey(null); return; }
    const d = { ...data };
    d[hospital].units = d[hospital].units.map(u => u === oldUnit ? newUnit.trim() : u);
    if (d[hospital].protocols[oldUnit]) {
      d[hospital].protocols[newUnit.trim()] = d[hospital].protocols[oldUnit];
      delete d[hospital].protocols[oldUnit];
    }
    saveHospitalData(d);
    setData(d);
    setEditKey(null);
  };

  const deleteUnit = (hospital, unit) => {
    if (!window.confirm(`Delete "${unit}" from ${hospital}? This only removes it from the picklist.`)) return;
    const d = { ...data };
    d[hospital].units = d[hospital].units.filter(u => u !== unit);
    delete d[hospital].protocols[unit];
    if (d[hospital].units.length === 0) delete d[hospital];
    saveHospitalData(d);
    setData(d);
  };

  if (hospitals.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: C.inkLight, fontSize: 13 }}>No saved units yet. Units are saved automatically when you log sessions.</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {hospitals.map(hospital => (
        <div key={hospital}>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>{hospital}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(data[hospital]?.units || []).map(unit => {
              const key = `${hospital}::${unit}`;
              const isEditing = editKey === key;
              return (
                <div key={unit} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  {isEditing ? (
                    <>
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") renameUnit(hospital, unit, editVal); if (e.key === "Escape") setEditKey(null); }}
                        style={{ flex: 1, background: C.surface, border: `1px solid ${C.primary}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, color: C.ink, outline: "none" }} />
                      <button onClick={() => renameUnit(hospital, unit, editVal)} style={{ background: C.primary, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer" }}>SAVE</button>
                      <button onClick={() => setEditKey(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>CANCEL</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: C.ink }}>{unit}</span>
                      <button onClick={() => { setEditKey(key); setEditVal(unit); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer" }}>RENAME</button>
                      <button onClick={() => deleteUnit(hospital, unit)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer" }}>DELETE</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button onClick={onClose} style={{ width: "100%", background: C.primary, border: "none", borderRadius: 8, padding: "12px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.06em", marginTop: 8 }}>DONE</button>
    </div>
  );
};

const FilterBar = ({ value, onChange, label, hospitals }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} className="filter-bar">
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em" }}>{label}</span>
    {["All", ...hospitals].map(h => (
      <button key={h} onClick={() => onChange(h)}
        style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${value === h ? C.primary : C.border}`, background: value === h ? C.primary : "none", color: value === h ? "white" : C.inkMid, minHeight: 36 }}>
        {h}
      </button>
    ))}
  </div>
);

// ── Email Modal ───────────────────────────────────────────────────────────────

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [viewAsUser, setViewAsUser] = useState(null); // { email, full_name } when admin is impersonating
  const [authLoading, setAuthLoading] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
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
  const [adminSection, setAdminSection] = useState("sessions"); // sessions | audit | users | hospitals | auto_reports
  const [reportSchedules, setReportSchedules] = useState([]);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ name: "", hospitals: [], recipients: "", frequency: "monthly", dayOfMonth: "1", dayOfWeek: "1", period: "30d" });
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSending, setScheduleSending] = useState(null);
  const [deletionRequestModal, setDeletionRequestModal] = useState(null); // { session } | null
  const [deletionRequestReason, setDeletionRequestReason] = useState("");
  const [reassignFrom, setReassignFrom] = useState(null);
  const [reassignTo, setReassignTo] = useState("");
  const [hospitalRenameFrom, setHospitalRenameFrom] = useState("");
  const [hospitalRenameTo, setHospitalRenameTo] = useState("");
  const [hospitalRenaming, setHospitalRenaming] = useState(false);
  const [sfSyncing, setSfSyncing] = useState({});
  const [configuringHospital, setConfiguringHospital] = useState(null);
  const [hospitalRenameResult, setHospitalRenameResult] = useState(null);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(() => {
    try { return JSON.parse(localStorage.getItem("caretrack_dismissed_dupes") || "[]"); } catch { return []; }
  });
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [editingNameSaving, setEditingNameSaving] = useState(false); // { count, error }

  // PWA install prompt
  const [pwaPrompt, setPwaPrompt] = useState(null); // deferred BeforeInstallPromptEvent
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(() => !!localStorage.getItem("caretrack_install_dismissed"));

  // User invite (admin)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("rep");
  const [inviteRegion, setInviteRegion] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null); // { ok, message }

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("caretrack_onboarded"));
  const [showChecklist, setShowChecklist] = useState(() => !localStorage.getItem("caretrack_checklist_dismissed"));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [practiceBedGrid, setPracticeBedGrid] = useState(() => {
    try { return [1, 2, 3, 4].map(n => createEmptyBed(METRICS, n)); }
    catch { return []; }
  });
  const [practiceSaving, setPracticeSaving] = useState(false);
  const [practiceError, setPracticeError] = useState(null);
  const [practiceSessionId, setPracticeSessionId] = useState(null);

  // Changelog
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("caretrack_dark");
    if (saved !== null) return saved === "true";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  // Follow system preference changes unless user has manually overridden
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = (e) => {
      if (localStorage.getItem("caretrack_dark") === null) setDarkMode(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Sync global C palette every render so all inline styles pick it up
  Object.assign(C, darkMode ? DARK : LIGHT);

  const [showChangelog, setShowChangelog] = useState(false);
  const [showUnitManager, setShowUnitManager] = useState(false);
  const [printSession, setPrintSession] = useState(null);
  const lastSeenVersion = localStorage.getItem("caretrack_changelog_seen");
  const CURRENT_VERSION = "3.3";
  const [changelogBadge, setChangelogBadge] = useState(lastSeenVersion !== CURRENT_VERSION);

  // White-label
  const [hospitalBranding, setHospitalBranding] = useState({});
  const [showBrandingEditor, setShowBrandingEditor] = useState(false);
  const [expandedBrandingHospital, setExpandedBrandingHospital] = useState(null);
  const [copyBrandingTo, setCopyBrandingTo] = useState(null);
  const [sfSuggestions, setSfSuggestions] = useState({}); // { hospitalName: [{ id, name }] }

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
  const [expandedPhotos, setExpandedPhotos] = useState(null); // lightbox URL or null
  const [editPhotos, setEditPhotos] = useState([]); // files staged for edit

  // Bed-level grid input mode
  const [inputMode, setInputMode] = useState(() => localStorage.getItem("caretrack_input_mode") || "grid"); // "simple" | "grid"
  const [auditHeelBoots, setAuditHeelBoots] = useState(false);
  const [auditTurnClock, setAuditTurnClock] = useState(false);
  const [bedGrid, setBedGrid] = useState([]);
  const [bedCount, setBedCount] = useState(0);
  const lastGridKey = useRef("");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("caretrack_chart_metrics")); return s || METRICS.slice(0, 3).map(m => m.id); } catch { return METRICS.slice(0, 3).map(m => m.id); }
  });
  const [hiddenMetrics, setHiddenMetrics] = useState(() => {
    try { return JSON.parse(localStorage.getItem("caretrack_hidden_metrics")) || []; } catch { return []; }
  });
  const toggleHideMetric = (id) => {
    setHiddenMetrics(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("caretrack_hidden_metrics", JSON.stringify(next));
      return next;
    });
  };
  const [hospitalFilter, setHospitalFilter] = useState("All");
  const [repFilter, setRepFilter] = useState("All");
  const [regionSortBy, setRegionSortBy] = useState("avg");
  const [regionSortDir, setRegionSortDir] = useState("desc");
  const [regionVPFilter, setRegionVPFilter] = useState("All");
  const [repChartMode, setRepChartMode] = useState("sessions");
  const [repChartPeriod, setRepChartPeriod] = useState("all");
  const [historyHospitalFilter, setHistoryHospitalFilter] = useState("All");
  const [historySearch, setHistorySearch] = useState("");
  const [performersView, setPerformersView] = useState("rankings"); // "rankings" | "planner"
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const summaryRef = useRef(null);

  const realIsAdmin = user && ADMIN_EMAILS.includes(user.email);
  const isAdmin = realIsAdmin && !viewAsUser;

  // Director role — derived from user_profiles once loaded
  const myProfile = userProfiles.find(p => p.email === user?.email);
  const isDirector = !isAdmin && myProfile?.role === "director";
  const isVP = !isAdmin && myProfile?.role === "vp";
  // KAM: either explicit role, OR admin with KAM accounts assigned
  const isKAM = !isAdmin && (myProfile?.role === "kam" || (myProfile?.accounts || []).length > 0);
  const myRegion = myProfile?.region || "";
  const kamAccounts = myProfile?.accounts || []; // array of hospital names assigned to this KAM
  const regionReps = isVP
    ? userProfiles.filter(p => p.role !== "vp" && p.role !== "director" && !ADMIN_EMAILS.includes(p.email) && p.email !== user?.email)
    : userProfiles.filter(p => p.region === myRegion && p.role !== "director" && p.email !== user?.email);
  const [regionEntries, setRegionEntries] = useState([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [kamEntries, setKamEntries] = useState([]);
  // When impersonating, override the display name and filter entries to that user only
  const userName = viewAsUser
    ? (viewAsUser.full_name || viewAsUser.email)
    : (user?.user_metadata?.full_name || user?.email || "");

  // Session streak — count consecutive weeks with at least one session logged by this user
  const streak = (() => {
    const userName2 = user?.user_metadata?.full_name || user?.email || "";
    const myEntries = entries.filter(e => e.logged_by === userName2 || !userName2);
    if (myEntries.length === 0) return 0;
    const getWeekKey = (dateStr) => {
      const d = new Date(dateStr);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      return `${d.getFullYear()}-${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`;
    };
    const weekSet = new Set(myEntries.map(e => getWeekKey(e.date)));
    let count = 0;
    const now = new Date();
    let check = new Date(now);
    while (true) {
      const key = getWeekKey(check.toISOString().slice(0, 10));
      if (!weekSet.has(key)) break;
      count++;
      check.setDate(check.getDate() - 7);
    }
    return count;
  })();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setUser(null);
        setShowPasswordReset(true);
      } else {
        setUser(session?.user ?? null);
        // Update last_login on every sign-in (covers password, magic link, token refresh)
        if (event === "SIGNED_IN" && session?.user?.email) {
          supabase.from("user_profiles")
            .update({ last_login: new Date().toISOString() })
            .eq("email", session.user.email)
            .then(() => {});
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Active hospital branding
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
      if (e.key === "5" && (isDirector || isVP)) setTab("region");
      if ((e.key === "5" && isAdmin) || (e.key === "6" && isAdmin)) setTab("admin");
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

    // Android PWA install prompt
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setPwaPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOnline || !user || offlineQueue.length === 0) return;
    (async () => {
      setSyncing(true);
      // userName defined above (proxy-aware)
  const realUserName = user?.user_metadata?.full_name || user?.email || "";
      const failed = [];
      let successCount = 0;
      for (const session of offlineQueue) {
        const { queuedAt, tempId, ...payload } = session;
        payload.logged_by = realUserName;
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
      const isAdminUser = ADMIN_EMAILS.includes(user?.email); // uses real user always

      // Step 1: Fetch user's own sessions to discover which hospitals they've logged for
      const { data: ownData, error } = await supabase.from("sessions")
        .select("*")
        .eq("logged_by", userName)
        .order("created_at", { ascending: true });
      if (error) { setDbError("Could not connect to database."); setLoading(false); return; }

      // Step 2: Get the unique hospitals this user has logged for
      const userHospitals = [...new Set((ownData || []).map(e => e.hospital).filter(Boolean))];

      // Step 3: Fetch sessions from shared hospitals only (not all hospitals)
      let allHospitalData = ownData || [];
      if (userHospitals.length > 0) {
        // Get branding to check which hospitals are shared
        const { data: brandingData } = await supabase.from("hospital_branding").select("hospital, is_shared");
        const sharedSet = new Set((brandingData || []).filter(b => b.is_shared).map(b => b.hospital));
        const sharedUserHospitals = userHospitals.filter(h => sharedSet.has(h));
        if (sharedUserHospitals.length > 0) {
          const { data: sharedData } = await supabase.from("sessions")
            .select("*")
            .in("hospital", sharedUserHospitals)
            .order("created_at", { ascending: true });
          // Merge own sessions + shared hospital sessions, dedup by id
          const merged = [...(ownData || [])];
          const ownIds = new Set(merged.map(e => e.id));
          (sharedData || []).forEach(e => { if (!ownIds.has(e.id)) merged.push(e); });
          allHospitalData = merged;
        }
      }

      setEntries(allHospitalData);

      // Seed localStorage hospital/unit data from existing entries (so picklist works immediately)
      allHospitalData.forEach(e => {
        if (e.hospital && e.location) saveHospitalUnit(e.hospital, e.location, e.protocol_for_use || "");
      });

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
        const { data: schedData } = await supabase.from("report_schedules").select("*").order("created_at", { ascending: false });
        setReportSchedules(schedData || []);
      }

      // All users get full user_profiles so director/region info is available
      if (!isAdminUser) {
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

  // Fetch all sessions for reps in director's region
  useEffect(() => {
    if (!isDirector && !isVP || !regionReps.length) return;
    (async () => {
      setRegionLoading(true);
      const repNames = regionReps.map(r => r.full_name || r.email).filter(Boolean);
      const { data } = await supabase.from("sessions").select("*")
        .in("logged_by", repNames)
        .order("created_at", { ascending: true });
      setRegionEntries(data || []);
      setRegionLoading(false);
    })();
  }, [isDirector, isVP, myRegion, regionReps.length]);

  // Fetch all sessions for KAM's assigned hospitals
  useEffect(() => {
    if (!isKAM || kamAccounts.length === 0) return;
    (async () => {
      const { data } = await supabase.from("sessions").select("*")
        .in("hospital", kamAccounts)
        .order("created_at", { ascending: true });
      setKamEntries(data || []);
    })();
  }, [isKAM, kamAccounts.join(",")]); // eslint-disable-line

  // Initialize bed grid when hospital/unit changes (grid mode)
  useEffect(() => {
    if (inputMode !== "grid" || !form.hospital || !form.location) return;
    const key = `${form.hospital}|||${form.location}`;
    if (key === lastGridKey.current) return; // same unit, don't recreate
    lastGridKey.current = key;
    const savedCount = getBedCount(form.hospital, form.location);
    const savedRooms = getBedRooms(form.hospital, form.location);
    if (savedCount > 0) {
      setBedCount(savedCount);
      const activeMetrics = getMetrics(form.hospital);
      const newGrid = [];
      for (let i = 0; i < savedCount; i++) {
        const room = savedRooms[i] || String(i + 1);
        const bed = createEmptyBed(activeMetrics, room);
        bed.room = room;
        newGrid.push(bed);
      }
      setBedGrid(newGrid);
    } else {
      setBedCount(0);
      setBedGrid([]);
    }
  }, [form.hospital, form.location, inputMode]);

  // Auto-sum bed grid values into the form's metric fields
  // Denominator = eligible (non-N/A) bed count; numerator = YES taps only
  useEffect(() => {
    if (inputMode !== "grid" || bedGrid.length === 0) return;
    const activeMetrics = getMetrics(form.hospital);
    const activeBeds2 = bedGrid.filter(b => !b.na);
    const updates = {};
    activeMetrics.forEach(m => {
      const eligible = activeBeds2.filter(b => !b[`${m.id}_na`]);
      const totalQ = eligible.length;
      const totalA = eligible.reduce((s, b) => s + (b[`${m.id}_a`] === "1" || b[`${m.id}_a`] === 1 ? 1 : 0), 0);
      updates[`${m.id}_den`] = totalQ > 0 ? String(totalQ) : "";
      updates[`${m.id}_num`] = totalQ > 0 ? String(totalA) : "";
    });
    setForm(f => ({ ...f, ...updates }));
  }, [bedGrid, inputMode, form.hospital]);

  // Fetch hospital branding from Supabase on load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("hospital_branding").select("*");
      if (data && data.length > 0) {
        const mapped = {};
        data.forEach(row => {
          mapped[row.hospital] = {
            logoUrl: row.logo_url || "",
            accentColor: row.accent_color || "",
            secondaryColor: row.secondary_color || "",
            tertiaryColor: row.tertiary_color || "",
            textColor: row.text_color || "",
            coverColor: row.cover_color || "",
            isTrial: row.is_trial || false,
            enabledMetrics: row.enabled_metrics || null,
            isShared: row.is_shared || false,
            salesforceAccountId: row.salesforce_account_id || "",
          };
        });
        setHospitalBranding(mapped);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (inputMode !== "grid" || bedGrid.length === 0 || !form.hospital || !form.location) return;
    const rooms = bedGrid.map(b => b.room || "");
    saveBedRooms(form.hospital, form.location, rooms);
  }, [bedGrid, inputMode, form.hospital, form.location]);

  // Handle bed count change — resize the grid
  const handleBedCountChange = (count) => {
    const n = Math.max(0, Math.min(100, parseInt(count) || 0));
    setBedCount(n);
    if (form.hospital && form.location && n > 0) {
      saveBedCount(form.hospital, form.location, n);
    }
    const activeMetrics = getMetrics(form.hospital);
    setBedGrid(prev => {
      if (n === 0) return [];
      const newGrid = [];
      for (let i = 0; i < n; i++) {
        if (i < prev.length) {
          // keep existing bed data, but ensure room is set
          const bed = { ...prev[i] };
          if (!bed.room) bed.room = String(i + 1);
          newGrid.push(bed);
        } else {
          const bed = createEmptyBed(activeMetrics, i + 1);
          bed.room = String(i + 1);
          newGrid.push(bed);
        }
      }
      return newGrid;
    });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setEntries([]); };
  const updateMetric = (id, field, val) => setForm(f => ({ ...f, [`${id}_${field}`]: val }));

  const handleSave = async () => {
    // Validation
    if (!form.date) { setSaveError("Date is required."); return; }
    if (!form.hospital.trim()) { setSaveError("Hospital name is required."); return; }
    if (!form.location.trim()) { setSaveError("Location / Unit is required."); return; }
    const hasMetric = METRICS.some(m => form[`${m.id}_num`] !== "" && form[`${m.id}_num`] !== "na" && form[`${m.id}_den`] !== "" && form[`${m.id}_den`] !== "na");
    if (!hasMetric) { setSaveError("Please fill in at least one metric before saving."); return; }


    // Duplicate detection — same date OR logged within last 4 hours for same unit
    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const duplicate = entries.find(e =>
      e.hospital?.toLowerCase().trim() === form.hospital.toLowerCase().trim() &&
      e.location?.toLowerCase().trim() === form.location.toLowerCase().trim() &&
      (e.date === form.date || (e.created_at && new Date(e.created_at).getTime() > fourHoursAgo))
    );
    if (duplicate) {
      const isRecent = duplicate.created_at && new Date(duplicate.created_at).getTime() > fourHoursAgo && duplicate.date !== form.date;
      const msg = isRecent
        ? `⚠️ A session for ${form.hospital} — ${form.location} was logged ${Math.round((Date.now() - new Date(duplicate.created_at).getTime()) / 60000)} minutes ago. Save another?`
        : `⚠️ A session for ${form.hospital} — ${form.location} on ${form.date} already exists. Save anyway?`;
      const proceed = window.confirm(msg);
      if (!proceed) return;
    }

    setSaving(true); setSaveError(null);
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";
    const payload = {
      date: form.date, hospital: form.hospital || null, location: form.location || null,
      protocol_for_use: form.protocol_for_use || null, notes: form.notes || null, logged_by: userName,
      ...Object.fromEntries(getMetrics(form.hospital).flatMap(m => [[`${m.id}_num`, form[`${m.id}_num`] === "na" ? null : parseInt(form[`${m.id}_num`]) || null], [`${m.id}_den`, form[`${m.id}_den`] === "na" ? null : parseInt(form[`${m.id}_den`]) || null]])),
      ...(inputMode === "grid" && bedGrid.length > 0 ? { bed_data: bedGrid } : {}),
    };
    // If offline, queue the session locally
    if (!isOnline) {
      const tempId = `offline_${Date.now()}`;
      const offlineSession = { ...payload, id: tempId, created_at: new Date().toISOString(), tempId, queuedAt: Date.now() };
      const newQueue = [...offlineQueue, offlineSession];
      setOfflineQueue(newQueue);
      localStorage.setItem("caretrack_offline_queue", JSON.stringify(newQueue));
      setEntries(prev => [...prev, offlineSession]);
      saveHospitalUnit(form.hospital, form.location, form.protocol_for_use);
      setForm(defaultForm()); setBedGrid([]); setBedCount(0); lastGridKey.current = ""; setSaving(false); setSaved(true);
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
    saveHospitalUnit(form.hospital, form.location, form.protocol_for_use);
    setForm(defaultForm()); setBedGrid([]); setBedCount(0); lastGridKey.current = ""; setSaving(false); setSaved(true);
    setSavedAt(data.created_at || new Date().toISOString());
    haptic("success"); // haptic on save

    // Send session confirmation email (fire and forget)
    setTimeout(async () => {
      try {
        const { error } = await supabase.functions.invoke("super-api", {
          body: { session: finalData, userEmail: user.email, userName },
        });
        if (error) console.warn("Session confirmation email error:", error);
      } catch (e) { console.warn("Session confirmation email failed:", e); }

      // Notify shared reps if this hospital is a shared account
      try {
        if (hospitalBranding[finalData.hospital]?.isShared) {
          await supabase.functions.invoke("notify-shared-reps", {
            body: { session: finalData, senderEmail: user.email, senderName: userName },
          });
        }
      } catch (e) { console.warn("Shared rep notification failed:", e); }

      // Push to Salesforce if hospital is mapped
      try {
        if (hospitalBranding[finalData.hospital]?.salesforceAccountId) {
          const sfRes = await supabase.functions.invoke("salesforce-sync", { body: { session: finalData } });
          if (!sfRes.error) {
            const syncedAt = new Date().toISOString();
            setEntries(prev => prev.map(e => e.id === finalData.id ? { ...e, sf_synced_at: syncedAt } : e));
            setAllEntriesFull(prev => prev.map(e => e.id === finalData.id ? { ...e, sf_synced_at: syncedAt } : e));
          }
        }
      } catch (e) { console.warn("Salesforce sync failed:", e); }
    }, 500);

    setTimeout(() => setSaved(false), 4000);
    // Show PWA install prompt after first session if not dismissed
    if (!installDismissed && (pwaPrompt || isIOS())) {
      setTimeout(() => setShowInstallBanner(true), 1500);
    }
    await logAudit("SESSION_CREATED", { hospital: payload.hospital, location: payload.location, date: payload.date }, null, data.id);
  };

  // Apply all filters
  const applyFilters = (list, hFilter) => list.filter(e => {
    if (hFilter !== "All" && e.hospital !== hFilter) return false;
    if (repFilter !== "All" && e.logged_by !== repFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  const proxyEntries = viewAsUser
    ? ((isDirector || isVP) ? regionEntries : allEntriesFull).filter(e => e.logged_by === (viewAsUser.full_name || viewAsUser.email))
    : (isDirector || isVP)
      ? [...entries, ...regionEntries].filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
      : isKAM
        ? kamEntries
        : entries;

  // Trial hospitals — excluded from Dashboard, Performers, Planner but kept in History/exports
  const trialHospitals = new Set(
    Object.entries(hospitalBranding)
      .filter(([, b]) => b.isTrial)
      .map(([h]) => h)
  );
  const isTrialHospital = (h) => trialHospitals.has(h);

  const hospitals = [...new Set(proxyEntries.map(e => e.hospital).filter(Boolean))].sort();
  const users = [...new Set(allEntriesFull.map(e => e.logged_by).filter(Boolean))].sort();
  const regionRepNames = [...new Set([...entries, ...regionEntries].map(e => e.logged_by).filter(Boolean))].sort();
  const filteredDashboard = applyFilters(proxyEntries, hospitalFilter).filter(e => !isTrialHospital(e.hospital));

  // Use branding for the selected hospital, or auto-detect if only one hospital in view
  const activeBranding = (() => {
    if (hospitalFilter !== "All" && hospitalBranding[hospitalFilter]) return hospitalBranding[hospitalFilter];
    const visibleHospitals = [...new Set(filteredDashboard.map(e => e.hospital).filter(Boolean))];
    if (visibleHospitals.length === 1 && hospitalBranding[visibleHospitals[0]]) return hospitalBranding[visibleHospitals[0]];
    return null;
  })();
  const filteredHistory = applyFilters(proxyEntries, historyHospitalFilter).filter(e => {
    if ((isDirector || isVP) && repFilter !== "All" && e.logged_by !== repFilter) return false;
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (e.notes || "").toLowerCase().includes(q)
      || (e.hospital || "").toLowerCase().includes(q)
      || (e.location || "").toLowerCase().includes(q);
  });

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
      if (!e.date) return false;
      const [y, m] = e.date.split("-").map(Number);
      return m - 1 === thisMonth && y === thisYear;
    });
    const lastMonthEntries = filteredDashboard.filter(e => {
      if (!e.date) return false;
      const [y, m] = e.date.split("-").map(Number);
      return m - 1 === lastMonth && y === lastMonthYear;
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

    // Sync edited session to Salesforce if hospital is mapped
    try {
      if (finalData.hospital && hospitalBranding[finalData.hospital]?.salesforceAccountId) {
        const sfRes = await supabase.functions.invoke("salesforce-sync", { body: { session: finalData } });
        if (!sfRes.error) {
          const syncedAt = new Date().toISOString();
          setEntries(prev => prev.map(e => e.id === finalData.id ? { ...e, sf_synced_at: syncedAt } : e));
          setAllEntriesFull(prev => prev.map(e => e.id === finalData.id ? { ...e, sf_synced_at: syncedAt } : e));
        }
      }
    } catch (e) { console.warn("Salesforce sync on edit failed:", e); }

    setEditingId(null);
    setEditForm({});
    setEditSaving(false);
  };

  // Upload photos to Supabase Storage and return public URLs
  const compressPhoto = (file) => new Promise((resolve) => {
    const MAX = 1200;
    const QUALITY = 0.82;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob || file), "image/jpeg", QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const uploadPhotos = async (files, sessionId) => {
    const urls = [];
    for (const file of files) {
      const compressed = await compressPhoto(file);
      const path = `${sessionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from("session-photos").upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
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

  const handleRequestDeletion = async (sessionId, reason) => {
    const { error } = await supabase.from("sessions")
      .update({ deletion_requested: true, deletion_reason: reason || null })
      .eq("id", sessionId);
    if (error) { alert("Failed to submit request: " + error.message); return; }
    const session = entries.find(e => e.id === sessionId);
    setEntries(prev => prev.map(e => e.id === sessionId ? { ...e, deletion_requested: true, deletion_reason: reason || null } : e));
    setAllEntriesFull(prev => prev.map(e => e.id === sessionId ? { ...e, deletion_requested: true, deletion_reason: reason || null } : e));
    await logAudit("DELETION_REQUESTED", { hospital: session?.hospital, location: session?.location, date: session?.date, reason: reason || null }, session?.logged_by, sessionId);
    setDeletionRequestModal(null);
    setDeletionRequestReason("");
  };

  const handleApproveDeletion = async (id) => {
    const session = allEntriesFull.find(e => e.id === id);
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) { alert("Failed to delete session: " + error.message); return; }
    setEntries(prev => prev.filter(e => e.id !== id));
    setAllEntriesFull(prev => prev.filter(e => e.id !== id));
    await logAudit("DELETION_APPROVED", { hospital: session?.hospital, location: session?.location, date: session?.date, logged_by: session?.logged_by }, session?.logged_by, id);
    // Delete from Salesforce if hospital is mapped
    try {
      if (session?.hospital && hospitalBranding[session.hospital]?.salesforceAccountId) {
        await supabase.functions.invoke("salesforce-sync", { body: { action: "delete", sessionId: id } });
      }
    } catch (e) { console.warn("SF delete failed:", e); }
  };

  const handleDenyDeletion = async (id) => {
    const { error } = await supabase.from("sessions")
      .update({ deletion_requested: false, deletion_reason: null })
      .eq("id", id);
    if (error) { alert("Failed to deny request: " + error.message); return; }
    const session = allEntriesFull.find(e => e.id === id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, deletion_requested: false, deletion_reason: null } : e));
    setAllEntriesFull(prev => prev.map(e => e.id === id ? { ...e, deletion_requested: false, deletion_reason: null } : e));
    await logAudit("DELETION_DENIED", { hospital: session?.hospital, location: session?.location, date: session?.date }, session?.logged_by, id);
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
    // Delete from Salesforce if hospital is mapped
    try {
      if (session?.hospital && hospitalBranding[session.hospital]?.salesforceAccountId) {
        await supabase.functions.invoke("salesforce-sync", { body: { action: "delete", sessionId: id } });
      }
    } catch (e) { console.warn("SF delete failed:", e); }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await generatePptx(filteredDashboard, summary, hospitalFilter, user?.user_metadata?.full_name || user?.email || "", activeBranding, chartData, momData); localStorage.setItem("caretrack_exported", "true"); } catch (e) { alert("PowerPoint export failed. Please try again."); }
    setExporting(false);
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try {
      // Fetch logo as base64 so jsPDF can embed it
      let brandingWithLogo = activeBranding ? { ...activeBranding } : null;
      if (activeBranding?.logoUrl) {
        try {
          const resp = await fetch(activeBranding.logoUrl);
          const blob = await resp.blob();
          const mime = blob.type.split("/")[1] || "png";
          const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.readAsDataURL(blob); });
          // Measure natural dimensions for proportional scaling in PDF
          const { w: logoW, h: logoH } = await new Promise(res => {
            const img = new Image();
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => res({ w: 300, h: 100 });
            img.src = URL.createObjectURL(blob);
          });
          brandingWithLogo = { ...brandingWithLogo, logoBase64: b64, logoMime: mime, logoWidth: logoW, logoHeight: logoH };
        } catch { /* logo fetch failed, continue without it */ }
      }
      await generatePdf(filteredDashboard, summary, false, hospitalFilter, user?.user_metadata?.full_name || user?.email || "", brandingWithLogo, chartData, momData, allEntries);
      localStorage.setItem("caretrack_exported", "true");
    } catch (e) { alert("PDF export failed. Please try again."); }
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

  // Mobile UX
  const [historyPage, setHistoryPage] = useState(20); // virtualised history — show N at a time
  const [pulling, setPulling] = useState(false);       // pull-to-refresh indicator
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const mainContentRef = useRef(null);

  // Cross-platform haptic feedback — navigator.vibrate on Android, AudioContext click on iOS
  const haptic = (type = "light") => {
    if (navigator.vibrate) {
      navigator.vibrate(type === "success" ? [40, 30, 40] : type === "heavy" ? 60 : 15);
    } else {
      // iOS fallback: tiny AudioContext click simulates haptic feel
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start();
        setTimeout(() => ctx.close(), 100);
      } catch {}
    }
  };
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = async (e) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
    const scrollTop = mainContentRef.current?.scrollTop ?? window.scrollY;
    // Pull down ≥80px, mostly vertical, at top of scroll
    if (dy > 80 && dx < 40 && scrollTop < 10 && (tab === "dashboard" || tab === "history")) {
      setPulling(true);
      haptic("light");
      // Refetch sessions
      const uName = user?.user_metadata?.full_name || user?.email;
      const { data } = await supabase.from("sessions").select("*").eq("logged_by", uName).order("created_at", { ascending: true });
      if (data) setEntries(data);
      setPulling(false);
    }
    // Swipe left/right to change tab
    const tabs = ["log", "dashboard", "history", "performers", "planner", ...((isDirector || isVP) ? ["region"] : []), ...(isAdmin ? ["admin"] : [])];
    const swipeX = e.changedTouches[0].clientX - touchStartX.current;
    const swipeY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(swipeX) > 60 && swipeY < 40) {
      const cur = tabs.indexOf(tab);
      if (swipeX < 0 && cur < tabs.length - 1) { setTab(tabs[cur + 1]); haptic("light"); }
      if (swipeX > 0 && cur > 0) { setTab(tabs[cur - 1]); haptic("light"); }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const Tab = ({ id, label, badge }) => (
    <button onClick={() => setTab(id)} style={{ padding: "10px 22px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.08em", color: tab === id ? C.primary : C.inkLight, borderBottom: tab === id ? `2px solid ${C.primary}` : "2px solid transparent", transition: "all 0.15s", position: "relative" }}>
      {label}
      {badge != null && <span style={{ marginLeft: 6, background: tab === id ? C.primary : C.surfaceAlt, color: tab === id ? "white" : C.inkMid, fontSize: 9, padding: "1px 6px", borderRadius: 10, fontFamily: "'IBM Plex Mono', monospace" }}>{badge}</span>}
    </button>
  );

  const DateRangeFilter = () => {
    const presets = [
      { label: "30D", days: 30 }, { label: "90D", days: 90 },
      { label: "YTD", ytd: true }, { label: "1Y", days: 365 },
    ];
    const applyPreset = (p) => {
      const to = new Date().toISOString().slice(0, 10);
      let from;
      if (p.ytd) { from = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10); }
      else { const d = new Date(); d.setDate(d.getDate() - p.days); from = d.toISOString().slice(0, 10); }
      setDateFrom(from); setDateTo(to);
    };
    const isActive = (p) => {
      if (!dateFrom || !dateTo) return false;
      const to = new Date().toISOString().slice(0, 10);
      if (dateTo !== to) return false;
      if (p.ytd) return dateFrom === new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const d = new Date(); d.setDate(d.getDate() - p.days);
      return dateFrom === d.toISOString().slice(0, 10);
    };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} className="date-filter">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em" }}>DATE</span>
        <div style={{ display: "flex", gap: 4 }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => isActive(p) ? (setDateFrom(""), setDateTo("")) : applyPreset(p)}
              style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${isActive(p) ? C.primary : C.border}`, background: isActive(p) ? C.primaryLight : "none", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: isActive(p) ? C.primary : C.inkLight, cursor: "pointer", letterSpacing: "0.04em" }}>
              {p.label}
            </button>
          ))}
        </div>
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
  };

  // Handle Supabase auth error redirects (e.g. expired magic link)
  const authErrorParams = (() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    return {
      error: params.get("error"),
      code: params.get("error_code"),
      description: params.get("error_description"),
    };
  })();

  if (authErrorParams.error) {
    const isExpired = authErrorParams.code === "otp_expired";
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "40px 36px", maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.redLight, border: `1px solid ${C.red}33`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>⚠</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red, letterSpacing: "0.12em", marginBottom: 12 }}>
            {isExpired ? "LINK EXPIRED" : "ACCESS DENIED"}
          </div>
          <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, color: C.ink, marginBottom: 12 }}>
            {isExpired ? "This link has expired" : "Something went wrong"}
          </h2>
          <p style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.6, marginBottom: 28 }}>
            {isExpired
              ? "Email sign-in links expire after 1 hour. Please return to the login page and request a new link or sign in with your password."
              : (authErrorParams.description?.replace(/\+/g, " ") || "An authentication error occurred.")}
          </p>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{ background: C.primary, color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", cursor: "pointer" }}>
            BACK TO LOGIN →
          </button>
          <div style={{ marginTop: 20, fontSize: 11, color: C.inkFaint }}>
            Need help? Contact Elizabeth Doherty — HoverTech CareTrack Administrator
          </div>
        </div>
      </div>
    );
  }

  // Password reset screen — shown when user clicks reset link from email
  if (showPasswordReset) {
    return <PasswordResetScreen onComplete={() => { setShowPasswordReset(false); }} />;
  }

  if (authLoading) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkLight }}>Loading...</div></div>;
  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <>
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        /* ── Mobile touch optimisations (global) ── */
        button, [role="button"], a {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        /* Prevent accidental text selection during swipe gestures */
        .bottom-nav, .nav-tabs, .filter-bar, .metric-card-hover,
        .history-card-top, .history-actions, .admin-sub-nav {
          user-select: none;
          -webkit-user-select: none;
        }
        /* Minimum tap target 44×44px for all interactive elements */
        button { min-height: 36px; }
        input, textarea { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        input,textarea { font-family: 'IBM Plex Sans', sans-serif; outline: none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 3px; }
        .savebtn:hover { background: ${C.primary} !important; color: white !important; border-color: ${C.primary} !important; }
        @keyframes savePulse {
          0%   { transform: scale(1); box-shadow: 0 0 0 0 ${C.green}66; }
          40%  { transform: scale(1.03); box-shadow: 0 0 0 8px ${C.green}00; }
          100% { transform: scale(1); box-shadow: 0 0 0 0 ${C.green}00; }
        }
        .savebtn-success { animation: savePulse 0.45s ease-out forwards; }
        .summarize:hover { background: ${C.primaryLight} !important; }
        .export-btn:hover { opacity: 0.85 !important; }
        .signout:hover { color: ${C.accent} !important; }
        .metric-card-hover:hover .hide-metric-btn { opacity: 1 !important; }
        .metric-card-hover:hover .hide-metric-btn:hover { background: ${C.surfaceAlt} !important; color: ${C.inkMid} !important; }
        .metric-card-hover { touch-action: manipulation; user-select: none; -webkit-user-select: none; cursor: default; }
        @media (max-width: 640px) {
          .metric-card-hover:active { opacity: 0.85; transform: scale(0.98); transition: transform 0.1s, opacity 0.1s; }
        }
        @media (max-width: 640px) {
          .admin-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .admin-user-card { flex-direction: column !important; }
          .admin-user-actions { flex-direction: row !important; width: 100% !important; margin-top: 10px; }
          .admin-user-actions button { flex: 1 !important; }
          .admin-sub-nav { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
          .admin-sub-nav button { white-space: nowrap !important; flex-shrink: 0 !important; }
        }
        /* Mobile optimisation */
        @media (max-width: 640px) {
          /* Hide top nav tabs — replaced by bottom nav */
          .nav-tabs { display: none !important; }

          /* Layout */
          .mobile-pad { padding: 16px 16px 100px !important; }
          .mobile-full { max-width: 100% !important; padding: 0 !important; }

          /* Header */
          .header-wrap { padding-top: env(safe-area-inset-top, 0px) !important; }
          .header-whats-new { display: none !important; }
          .header-signout { display: none !important; }
          .header-secondary-strip { display: flex !important; }
          .header-outer { padding: 0 16px !important; }
          .header-subtitle { display: none !important; }
          .header-meta { display: none !important; }
          .header-session-count { display: none !important; }
          .header-status { display: none !important; }
          .header-divider { display: none !important; }
          .header-user-name { display: none !important; }
          .header-right { gap: 8px !important; }

          /* Inputs */
          input, textarea, select { font-size: 16px !important; }

          /* Sticky save button — log tab only */
          .savebtn {
            position: fixed !important;
            bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            padding: 16px !important;
            font-size: 13px !important;
            z-index: 90 !important;
            border-radius: 12px !important;
            box-shadow: 0 -2px 20px rgba(0,0,0,0.18) !important;
          }

          /* Extra bottom padding on log tab so content isn't hidden behind sticky save */
          .log-form-bottom { padding-bottom: 100px !important; }

          /* Dashboard */
          .dashboard-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .dashboard-filters { align-items: flex-start !important; width: 100% !important; }
          .dashboard-title { font-size: 20px !important; }
          .metric-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .export-row { flex-direction: column !important; gap: 8px !important; }
          .export-row button { width: 100% !important; justify-content: center !important; }
          .mom-grid { grid-template-columns: 1fr !important; }
          .chart-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .mom-metric-row { font-size: 11px !important; }
          .mom-delta { min-width: 36px !important; }

          /* Filter bar */
          .filter-bar { flex-wrap: wrap !important; }
          .date-filter { flex-wrap: wrap !important; gap: 6px !important; }
          .date-filter input[type=date] { flex: 1 !important; min-width: 120px !important; }

          /* History */
          .history-card-top { flex-direction: column !important; gap: 12px !important; }
          .history-actions { flex-wrap: wrap !important; gap: 6px !important; justify-content: flex-start !important; }
          .history-actions button, .history-actions span { flex: 1 1 auto !important; text-align: center !important; justify-content: center !important; min-width: 80px !important; }
          .history-metric-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }
          .history-notes { max-width: 100% !important; text-align: left !important; }

          /* Admin */
          .admin-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .admin-sub-nav { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
          .admin-sub-nav button { white-space: nowrap !important; flex-shrink: 0 !important; }
          .admin-user-card { flex-direction: column !important; }
          .admin-user-actions { flex-direction: row !important; width: 100% !important; margin-top: 10px; }
          .admin-user-actions button { flex: 1 !important; }
          .user-card-row { flex-wrap: wrap !important; }
          .user-actions { flex-direction: row !important; width: 100% !important; margin-top: 10px; }
          .user-actions button { flex: 1; }

          /* Bottom nav */
          .bottom-nav { display: flex !important; }
        }
        /* Print styles */
        @media print {
          body * { visibility: hidden; }
          .print-modal-overlay { visibility: visible !important; position: fixed !important; inset: 0 !important; background: white !important; display: flex !important; align-items: flex-start !important; justify-content: center !important; padding: 32px !important; z-index: 9999 !important; }
          .print-modal-overlay * { visibility: visible !important; }
          .print-modal-content { box-shadow: none !important; border-radius: 0 !important; max-height: none !important; overflow: visible !important; width: 100% !important; max-width: 700px !important; }
          .no-print { display: none !important; }
        }
      `}</style>


      {/* ── IMPERSONATION BANNER ── */}
      {viewAsUser && (
        <div style={{ background: C.amber, padding: "10px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>👁</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: "white", letterSpacing: "0.06em" }}>
              VIEWING AS: {viewAsUser.full_name || viewAsUser.email}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.8)" }}>
              — read-only view of their data
            </span>
          </div>
          <button onClick={() => { setViewAsUser(null); setTab(realIsAdmin ? "admin" : "region"); }}
            style={{ background: "white", border: "none", borderRadius: 6, padding: "5px 16px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.amber, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}>
            EXIT VIEW ✕
          </button>
        </div>
      )}
      {(isDirector || isVP) && repFilter !== "All" && !viewAsUser && (
        <div style={{ background: C.primaryLight, borderBottom: `1px solid ${C.primary}33`, padding: "8px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.primary, letterSpacing: "0.06em" }}>
            FILTERED: {repFilter}
          </span>
          <button onClick={() => setRepFilter("All")} style={{ background: "none", border: `1px solid ${C.primary}44`, borderRadius: 6, padding: "3px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", letterSpacing: "0.05em" }}>
            CLEAR FILTER ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="header-wrap" style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(79,110,119,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 32px" }} className="header-outer">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <img src="/hovertech-logo.png" alt="HoverTech" style={{ height: 36, objectFit: "contain" }} />
              <div style={{ width: 1, height: 28, background: C.border }} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.15em" }}>CARETRACK</div>
                <div className="header-subtitle" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkFaint, letterSpacing: "0.1em" }}>WOUND CARE COMPLIANCE</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }} className="header-right">
              <span className="header-status">{!isOnline
                ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber }}>● OFFLINE{offlineQueue.length > 0 ? ` · ${offlineQueue.length} QUEUED` : ""}</span>
                : syncing
                  ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>● SYNCING...</span>
                  : !loading && !dbError
                    ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>● CONNECTED</span>
                    : dbError
                      ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red }}>● DB ERROR</span>
                      : null
              }</span>
              {syncResult && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>{syncResult}</span>}
              <button className="header-whats-new" onClick={() => { setShowChangelog(true); setChangelogBadge(false); localStorage.setItem("caretrack_changelog_seen", CURRENT_VERSION); }}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", position: "relative" }}>
                WHAT'S NEW {changelogBadge && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: C.red }} />}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="header-meta">
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight }} className="header-session-count">{entries.length} SESSIONS{offlineQueue.length > 0 ? ` (${offlineQueue.length} pending)` : ""}</div>
                {streak > 0 && (
                  <div title={`${streak} consecutive week${streak !== 1 ? "s" : ""} with sessions logged`}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: streak >= 4 ? C.amberLight : C.surfaceAlt, border: `1px solid ${streak >= 4 ? C.amber : C.border}`, borderRadius: 12, padding: "2px 8px" }}>
                    <span style={{ fontSize: 12 }}>{streak >= 8 ? "🔥" : streak >= 4 ? "⚡" : "✦"}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: streak >= 4 ? C.amber : C.inkLight, letterSpacing: "0.05em" }}>{streak}W STREAK</span>
                  </div>
                )}
              </div>
              <div style={{ width: 1, height: 20, background: C.border }} className="header-divider" />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: isAdmin ? C.accentLight : C.primaryLight, border: `1px solid ${isAdmin ? C.accent : C.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: isAdmin ? C.accent : C.primary }}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="header-user-name">
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, lineHeight: 1.2 }}>{userName}</div>
                  {isAdmin && <div style={{ fontSize: 9, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>ADMIN</div>}
                </div>
                <button onClick={() => {
                    const next = !darkMode;
                    setDarkMode(next);
                    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
                    if (next === systemDark) localStorage.removeItem("caretrack_dark");
                    else localStorage.setItem("caretrack_dark", next);
                  }}
                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 20, cursor: "pointer", fontSize: 14, padding: "3px 10px", color: C.inkLight, transition: "all 0.2s", lineHeight: 1 }}
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
                  {darkMode ? "☀️" : "🌙"}
                </button>
                <button className="signout header-signout" onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.05em", transition: "color 0.15s" }}>SIGN OUT</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 4 }} className="nav-tabs">
            <Tab id="log" label="LOG AUDIT" />
            <Tab id="dashboard" label="DASHBOARD" />
            <Tab id="history" label="HISTORY" badge={entries.length > 0 ? entries.length : null} />
            <Tab id="performers" label="PERFORMERS" />
            <Tab id="planner" label="PLANNER" />
            {(isDirector || isVP || isAdmin) && <Tab id="region" label={isVP || isAdmin ? "ALL REGIONS" : "MY REGION"} />}
            {isAdmin && <Tab id="admin" label="ADMIN" badge="ADMIN" />}
          </div>

          {/* Secondary strip — mobile only, shows items hidden from main header row */}
          <div className="header-secondary-strip" style={{ display: "none", alignItems: "center", justifyContent: "space-between", padding: "4px 0 6px", borderTop: `0.5px solid ${C.border}` }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkLight }}>
              {entries.length} SESSIONS{offlineQueue.length > 0 ? ` · ${offlineQueue.length} PENDING` : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setShowChangelog(true); setChangelogBadge(false); localStorage.setItem("caretrack_changelog_seen", CURRENT_VERSION); }}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", position: "relative", whiteSpace: "nowrap" }}>
                WHAT'S NEW {changelogBadge && <span style={{ position: "absolute", top: -3, right: -3, width: 6, height: 6, borderRadius: "50%", background: C.red }} />}
              </button>
              <button className="signout" onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.05em" }}>SIGN OUT</button>
            </div>
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

      <div ref={mainContentRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 32px 120px" }} className="mobile-pad">

        {/* Pull-to-refresh indicator */}
        {pulling && (
          <div style={{ textAlign: "center", padding: "8px 0 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary, letterSpacing: "0.08em" }}>
            ↻ REFRESHING...
          </div>
        )}

        {/* ── LOG SESSION ── */}
        {tab === "log" && (
          <div style={{ maxWidth: 720 }} className="mobile-full log-form-bottom">
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400 }}>Log Audit</h1>
              <p style={{ color: C.inkMid, fontSize: 13, marginTop: 4 }}>Logging as <strong>{userName}</strong>{viewAsUser && <span style={{ color: C.amber, marginLeft: 6 }}>(viewing as {userName})</span>}</p>
            </div>

            {/* Monthly summary strip */}
            {(() => {
              const now = new Date();
              const thisMonth = now.getMonth();
              const thisYear = now.getFullYear();
              const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
              const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
              const myName = user?.user_metadata?.full_name || user?.email || "";
              const myEntries = isKAM ? kamEntries : entries.filter(e => e.logged_by === myName);
              const thisMonthSessions = myEntries.filter(e => {
                if (!e.date) return false;
                const [y, m] = e.date.split("-").map(Number);
                return m - 1 === thisMonth && y === thisYear;
              });
              const lastMonthSessions = myEntries.filter(e => {
                if (!e.date) return false;
                const [y, m] = e.date.split("-").map(Number);
                return m - 1 === lastMonth && y === lastMonthYear;
              });
              const thisMonthHospitals = new Set(thisMonthSessions.map(e => e.hospital).filter(Boolean)).size;
              const delta = thisMonthSessions.length - lastMonthSessions.length;
              const monthName = now.toLocaleString("en-US", { month: "long" });
              const avgCompliance = (() => {
                const vals = METRICS.flatMap(m => thisMonthSessions.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
              })();
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
                  {[
                    {
                      label: `${monthName} Sessions`,
                      value: thisMonthSessions.length,
                      sub: delta === 0 ? "same as last month" : `${delta > 0 ? "+" : ""}${delta} vs last month`,
                      subColor: delta > 0 ? C.green : delta < 0 ? C.red : C.inkLight,
                    },
                    {
                      label: "Hospitals",
                      value: thisMonthHospitals,
                      sub: `this month`,
                      subColor: C.inkLight,
                    },
                    {
                      label: "Avg Compliance",
                      value: avgCompliance !== null ? `${avgCompliance}%` : "—",
                      sub: "this month",
                      subColor: avgCompliance !== null ? pctColor(avgCompliance) : C.inkLight,
                      valueColor: avgCompliance !== null ? pctColor(avgCompliance) : C.inkFaint,
                    },
                  ].map(({ label, value, sub, subColor, valueColor }) => (
                    <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 6 }}>{label.toUpperCase()}</div>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 700, color: valueColor || C.ink, lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 10, color: subColor, marginTop: 4 }}>{sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>DATE <span style={{ color: C.red }}>*</span></label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink }}
                onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <HospitalInput value={form.hospital} onChange={val => { setForm(f => ({ ...f, hospital: val, location: "", protocol_for_use: "" })); setAuditHeelBoots(false); setAuditTurnClock(false); }} hospitals={isKAM ? kamAccounts : hospitals} entries={isKAM ? kamEntries : entries} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <UnitInput
                value={form.location}
                hospital={form.hospital}
                onChange={val => {
                  const savedProtocol = getProtocolForUnit(form.hospital, val);
                  setForm(f => ({ ...f, location: val, ...(savedProtocol ? { protocol_for_use: savedProtocol } : {}) }));
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>PROTOCOL FOR USE</label>
              <textarea value={form.protocol_for_use} onChange={e => setForm(f => ({ ...f, protocol_for_use: e.target.value }))} placeholder="Describe the protocol or intended use for this audit..."
                rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {/* Input mode toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em" }}>COMPLIANCE METRICS</label>
                <div style={{ display: "flex", background: C.surfaceAlt, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  {[["simple", "Simple"], ["grid", "Per Bed"]].map(([mode, label]) => (
                    <button key={mode} onClick={() => { setInputMode(mode); localStorage.setItem("caretrack_input_mode", mode); }}
                      style={{ padding: "5px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em", cursor: "pointer", border: "none", transition: "all 0.15s",
                        background: inputMode === mode ? C.primary : "transparent", color: inputMode === mode ? "white" : C.inkLight }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {isKaiser(form.hospital) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ background: auditHeelBoots ? C.amberLight : C.surfaceAlt, border: `1px solid ${auditHeelBoots ? C.amber : C.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        <input type="checkbox" checked={auditHeelBoots} onChange={e => setAuditHeelBoots(e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: C.amber, cursor: "pointer" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: auditHeelBoots ? C.amber : C.inkLight, letterSpacing: "0.06em", marginBottom: 3 }}>👢  AUDIT HEEL BOOTS</div>
                        <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>Check this box to include the <strong>Heel Boots On</strong> compliance metric for this session.</div>
                      </div>
                    </label>
                  </div>
                  <div style={{ background: auditTurnClock ? C.amberLight : C.surfaceAlt, border: `1px solid ${auditTurnClock ? C.amber : C.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                      <div style={{ marginTop: 2, flexShrink: 0 }}>
                        <input type="checkbox" checked={auditTurnClock} onChange={e => setAuditTurnClock(e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: C.amber, cursor: "pointer" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: auditTurnClock ? C.amber : C.inkLight, letterSpacing: "0.06em", marginBottom: 3 }}>🕐  AUDIT TURN CLOCK</div>
                        <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>Check this box to include the <strong>Turn Clock</strong> compliance metric for this session.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              {inputMode === "simple" ? (
                getMetrics(form.hospital).filter(m => (m.id !== "heel_boots" || auditHeelBoots) && (m.id !== "turn_clock" || auditTurnClock)).map(m => <MetricInput key={m.id} metric={m} num={form[`${m.id}_num`]} den={form[`${m.id}_den`]} onChange={(field, val) => updateMetric(m.id, field, val)} />)
              ) : (
                <>
                  {/* Bed count input */}
                  {form.hospital && form.location ? (
                    <>
                      {/* Early duplicate warning */}
                      {(() => {
                        const earlyDup = form.date && entries.find(e =>
                          e.date === form.date &&
                          e.hospital?.toLowerCase().trim() === form.hospital.toLowerCase().trim() &&
                          e.location?.toLowerCase().trim() === form.location.toLowerCase().trim()
                        );
                        return earlyDup ? (
                          <div style={{ background: C.amberLight, border: `1px solid ${C.amber}44`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em", marginBottom: 3 }}>DUPLICATE SESSION</div>
                              <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>
                                A session for <strong>{form.hospital} — {form.location}</strong> on <strong>{form.date}</strong> already exists. You can still save, but check if this is intentional.
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: "0 0 auto" }}>
                          <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 4 }}>NUMBER OF BEDS</label>
                          <input type="number" min="1" max="100" value={bedCount || ""} placeholder="0"
                            onChange={e => handleBedCountChange(e.target.value)}
                            style={{ width: 80, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 16, fontFamily: "'Libre Baskerville', serif", color: C.ink, textAlign: "center" }}
                            onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                        </div>
                        {bedCount > 0 && (
                          <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", paddingTop: 16, display: "flex", alignItems: "center", gap: 6 }}>
                            {form.location} · {bedCount} bed{bedCount !== 1 ? "s" : ""}
                            {getBedCount(form.hospital, form.location) > 0 && (
                              <span style={{ background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 10, padding: "1px 7px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em" }}>SAVED</span>
                            )}
                          </div>
                        )}
                      </div>
                      {bedCount > 0 && bedGrid.length > 0 && (
                        <BedGrid
                          metrics={getMetrics(form.hospital).filter(m => (m.id !== "heel_boots" || auditHeelBoots) && (m.id !== "turn_clock" || auditTurnClock))}
                          hospital={form.hospital}
                          beds={bedGrid}
                          onChange={setBedGrid}
                          onAddBed={() => {
                            const activeMetrics = getMetrics(form.hospital);
                            const newCount = bedCount + 1;
                            setBedCount(newCount);
                            saveBedCount(form.hospital, form.location, newCount);
                            const newBed = createEmptyBed(activeMetrics, newCount);
                            newBed.room = String(newCount);
                            setBedGrid(prev => [...prev, newBed]);
                          }}
                          onRemoveBed={(idx) => {
                            const newCount = Math.max(1, bedCount - 1);
                            setBedCount(newCount);
                            saveBedCount(form.hospital, form.location, newCount);
                            setBedGrid(prev => prev.filter((_, i) => i !== idx));
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div style={{ padding: "24px 0", textAlign: "center", color: C.inkLight, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                      Select a hospital and unit above to enter bed-level data.
                    </div>
                  )}
                </>
              )}
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
            <button className={`savebtn${saved ? " savebtn-success" : ""}`} onClick={handleSave} disabled={saving || !!dbError}
              style={{ background: saved ? C.green : !isOnline ? C.amberLight : C.surfaceAlt, border: `1px solid ${saved ? C.green : !isOnline ? C.amber : C.borderDark}`, borderRadius: 8, padding: "12px 28px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: saved ? "white" : !isOnline ? C.amber : C.ink, cursor: saving ? "not-allowed" : "pointer", transition: "background 0.2s, color 0.2s, border-color 0.2s", opacity: saving ? 0.6 : 1 }}>
              {saved ? `✓ SAVED · ${savedAt ? new Date(savedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}` : saving ? "SAVING..." : !isOnline ? "SAVE OFFLINE →" : "SAVE SESSION →"}
            </button>
          </div>
        )}

        {/* ── DELETION REQUEST MODAL ── */}
      {deletionRequestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 32, width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.red, letterSpacing: "0.08em", marginBottom: 8 }}>REQUEST SESSION DELETION</div>
            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, color: C.ink, marginBottom: 4 }}>{deletionRequestModal.session.hospital}</div>
            <div style={{ fontSize: 13, color: C.inkMid, marginBottom: 20 }}>{deletionRequestModal.session.date}{deletionRequestModal.session.location ? ` · ${deletionRequestModal.session.location}` : ""}</div>
            <div style={{ fontSize: 13, color: C.inkMid, marginBottom: 16, lineHeight: 1.6 }}>This will notify an admin to review and delete this session. You can add an optional reason below.</div>
            <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>REASON (OPTIONAL)</label>
            <textarea value={deletionRequestReason} onChange={e => setDeletionRequestReason(e.target.value)}
              placeholder="e.g. Entered incorrect data, duplicate session..."
              rows={3} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.ink, resize: "vertical", lineHeight: 1.5, marginBottom: 20, boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setDeletionRequestModal(null); setDeletionRequestReason(""); }}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 20px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer" }}>CANCEL</button>
              <button onClick={() => handleRequestDeletion(deletionRequestModal.session.id, deletionRequestReason)}
                style={{ background: C.red, border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em" }}>SUBMIT REQUEST</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            {/* Hospital branding banner */}
            {activeBranding && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 20px", background: activeBranding.accentColor ? activeBranding.accentColor + "18" : C.primaryLight, border: `1px solid ${activeBranding.accentColor || C.primary}33`, borderRadius: 10 }}>
                {activeBranding.logoUrl && (
                  <img src={activeBranding.logoUrl} alt={hospitalFilter} style={{ height: 40, maxWidth: 140, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                )}
                <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 16, fontWeight: 700, color: activeBranding.accentColor || C.primary }}>{hospitalFilter}</div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }} className="dashboard-header">
              <div>
                <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4, color: activeBranding?.accentColor || C.ink }} className="dashboard-title">Compliance Dashboard</h1>
                <p style={{ color: C.inkMid, fontSize: 13 }}>{loading ? "Loading..." : `${filteredDashboard.length} session${filteredDashboard.length !== 1 ? "s" : ""}${hospitalFilter !== "All" ? ` · ${hospitalFilter}` : ""}${repFilter !== "All" ? ` · ${repFilter.split(" ")[0]}` : ""}${dateFrom || dateTo ? ` · filtered` : ""}`}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }} className="dashboard-filters">
                {hospitals.length > 0 && <FilterBar value={hospitalFilter} onChange={setHospitalFilter} label="HOSPITAL" hospitals={hospitals} />}
                {(isDirector || isVP) && regionRepNames.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="filter-bar">
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>REP</span>
                    <select value={repFilter} onChange={e => setRepFilter(e.target.value)}
                      style={{ background: repFilter !== "All" ? C.primary : C.surface, border: `1px solid ${repFilter !== "All" ? C.primary : C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: repFilter !== "All" ? "white" : C.inkMid, cursor: "pointer", outline: "none", minHeight: 36 }}>
                      <option value="All">All Reps</option>
                      {regionRepNames.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {repFilter !== "All" && (
                      <button onClick={() => setRepFilter("All")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.inkLight, padding: "0 4px" }}>✕</button>
                    )}
                  </div>
                )}
                <DateRangeFilter />
              </div>
            </div>
            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>Loading data...</div>
            ) : (
              <>
                {/* ── Last Session Card ── */}
                {(() => {
                  const myName = user?.user_metadata?.full_name || user?.email || "";
                  const mySessions = (isDirector || isVP) ? proxyEntries : proxyEntries.filter(e => e.logged_by === myName);
                  const last = [...mySessions].sort((a, b) => (b.created_at || b.date || "").localeCompare(a.created_at || a.date || ""))[0];
                  if (!last) return null;
                  const metrics = getMetrics(last.hospital);
                  const vals = metrics.map(m => pct(last[`${m.id}_num`], last[`${m.id}_den`])).filter(v => v !== null);
                  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                  const days = last.date ? Math.floor((new Date() - (() => { const [y,m,d] = last.date.split("-").map(Number); return new Date(y,m-1,d); })()) / 86400000) : null;
                  const daysLabel = days === null ? "" : days === 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
                  const metricRows = metrics.slice(0, 4).map(m => ({ label: m.label, val: pct(last[`${m.id}_num`], last[`${m.id}_den`]) }));
                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${overall !== null ? pctColor(overall) : C.border}`, borderRadius: "0 12px 12px 0", padding: "16px 18px", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>LAST SESSION</div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.hospital || "—"}</div>
                          <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>
                            {last.location && `${last.location} · `}{last.date}{daysLabel && <span style={{ marginLeft: 6, color: days === 0 ? C.green : days <= 7 ? C.green : C.inkLight }}>{daysLabel}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color: overall !== null ? pctColor(overall) : C.inkFaint, lineHeight: 1 }}>{overall !== null ? `${overall}%` : "—"}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkLight, marginTop: 2 }}>OVERALL</div>
                        </div>
                      </div>
                      {/* Mini metric bars */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px", marginBottom: 12 }}>
                        {metricRows.map(({ label, val }) => (
                          <div key={label}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                              <span style={{ fontSize: 10, color: C.inkLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{label}</span>
                              <span style={{ fontSize: 10, fontWeight: 500, color: val !== null ? pctColor(val) : C.inkFaint, flexShrink: 0 }}>{val !== null ? `${val}%` : "—"}</span>
                            </div>
                            <div style={{ height: 3, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${val ?? 0}%`, background: val !== null ? pctColor(val) : C.surfaceAlt, borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Footer */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `0.5px solid ${C.border}` }}>
                        <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>
                          LOGGED BY {(last.logged_by || "").toUpperCase()}
                        </div>
                        <button onClick={() => setTab("history")} style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "3px 10px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", letterSpacing: "0.05em" }}>
                          VIEW IN HISTORY →
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {/* ── Getting Started Checklist ── */}
                {showChecklist && !isAdmin && !isDirector && !isVP && (() => {
                  const myName = user?.user_metadata?.full_name || user?.email || "";
                  const mySessions = entries.filter(e => e.logged_by === myName && e.hospital !== "Practice Hospital");
                  const hasLoggedSession = mySessions.length > 0;
                  const hasAddedHospital = mySessions.some(e => e.hospital);
                  const hasUsedPerBed = mySessions.some(e => e.bed_data && e.bed_data.length > 0);
                  const hasExported = !!localStorage.getItem("caretrack_exported");
                  const hasPWA = window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone;

                  const steps = [
                    { label: "Log your first session", sub: "Tap Log Audit and record a compliance visit", done: hasLoggedSession },
                    { label: "Add your first hospital", sub: "Type a hospital name on the Log Audit form", done: hasAddedHospital },
                    { label: "Try Per Bed mode", sub: "Switch to Per Bed on the Log form and enter room-by-room data", done: hasUsedPerBed },
                    { label: "Export a report", sub: "From Dashboard, tap PDF or PowerPoint to download", done: hasExported },
                    { label: "Install on your phone", sub: "Tap Share → Add to Home Screen in Safari for offline access", done: hasPWA },
                  ];
                  const doneCount = steps.filter(s => s.done).length;
                  const allDone = doneCount === steps.length;
                  const progress = Math.round((doneCount / steps.length) * 100);

                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.primary, letterSpacing: "0.1em", marginBottom: 3 }}>GETTING STARTED</div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{allDone ? "You're all set!" : `${doneCount} of ${steps.length} complete`}</div>
                        </div>
                        <button onClick={() => { setShowChecklist(false); localStorage.setItem("caretrack_checklist_dismissed", "true"); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.inkLight, padding: "4px 8px" }}>✕</button>
                      </div>
                      <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden", marginBottom: 14 }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: allDone ? C.green : C.primary, borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {steps.map((step, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: i < steps.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${step.done ? C.green : C.border}`, background: step.done ? C.green : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                              {step.done && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: step.done ? C.inkLight : C.ink, textDecoration: step.done ? "line-through" : "none" }}>{step.label}</div>
                              {!step.done && <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>{step.sub}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {allDone && (
                        <button onClick={() => { setShowChecklist(false); localStorage.setItem("caretrack_checklist_dismissed", "true"); }}
                          style={{ width: "100%", marginTop: 14, background: C.primary, border: "none", borderRadius: 8, padding: "11px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.08em" }}>
                          ALL DONE — DISMISS →
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* ── YTD Summary Card ── */}
                {(() => {
                  const now = new Date();
                  const jan1 = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
                  const ytdEntries = filteredDashboard.filter(e => e.date >= jan1);
                  if (ytdEntries.length === 0) return null;
                  const ytdHospitals = new Set(ytdEntries.map(e => e.hospital).filter(Boolean)).size;
                  const ytdVals = METRICS.flatMap(m => ytdEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                  const ytdAvg = ytdVals.length ? Math.round(ytdVals.reduce((a, b) => a + b, 0) / ytdVals.length) : null;
                  const ytdBeds = ytdEntries.reduce((sum, e) => {
                    if (e.bed_data && e.bed_data.length > 0) return sum + e.bed_data.length;
                    return sum + (parseInt(e.matt_applied_den) || 0);
                  }, 0);
                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 12 }}>YEAR TO DATE · {now.getFullYear()}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="metric-grid">
                        {[
                          { label: "Sessions", value: ytdEntries.length, color: C.primary },
                          { label: "Hospitals", value: ytdHospitals, color: C.primary },
                          { label: "Pt Beds Audited", value: ytdBeds, color: C.primary },
                          { label: "Avg Compliance", value: ytdAvg !== null ? `${ytdAvg}%` : "—", color: ytdAvg !== null ? pctColor(ytdAvg) : C.inkFaint },
                        ].map(s => (
                          <div key={s.label} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                            <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.06em", marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {METRIC_BUCKETS.map(bucket => {
                  const bucketMetrics = avgByMetric.filter(m => bucket.ids.includes(m.id) && !hiddenMetrics.includes(m.id));
                  if (bucketMetrics.length === 0) return null;
                  return (
                    <div key={bucket.label} style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 8, paddingLeft: 2 }}>{bucket.label.toUpperCase()}</div>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(bucketMetrics.length, 4)}, 1fr)`, gap: 12 }} className="metric-grid">
                        {bucketMetrics.map(m => {
                    const diff = m.avg !== null && m.national !== null ? m.avg - m.national : null;
                    const showNational = hospitalFilter !== "All" && m.national !== null;
                    return (
                    <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", position: "relative" }} className="metric-card-hover">
                      <button onClick={() => toggleHideMetric(m.id)} title="Hide this metric" style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: C.inkFaint, opacity: 0, transition: "opacity 0.15s", padding: "2px 4px", borderRadius: 4, lineHeight: 1 }} className="hide-metric-btn">✕</button>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: C.inkLight, lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{m.label}</div>
                        <MetricIcon id={m.id} size={52} color={m.avg !== null ? pctColor(m.avg) : C.inkFaint} />
                      </div>
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
                    </div>
                  );
                })}
                {/* Hidden metrics restore bar */}
                {hiddenMetrics.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "8px 14px", background: C.surfaceAlt, borderRadius: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.06em" }}>HIDDEN:</span>
                    {hiddenMetrics.map(id => {
                      const m = METRICS.find(x => x.id === id);
                      return m ? (
                        <button key={id} onClick={() => toggleHideMetric(id)}
                          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "3px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                          + {m.label}
                        </button>
                      ) : null;
                    })}
                    <button onClick={() => { setHiddenMetrics([]); localStorage.removeItem("caretrack_hidden_metrics"); }}
                      style={{ background: "none", border: "none", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", marginLeft: "auto" }}>
                      RESTORE ALL
                    </button>
                  </div>
                )}
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }} className="mom-grid">
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
                        <button key={m.id} className="metric-toggle" onClick={() => setSelectedMetrics(prev => { const next = active ? prev.filter(x => x !== m.id) : [...prev, m.id]; localStorage.setItem("caretrack_chart_metrics", JSON.stringify(next)); return next; })}
                          style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${active ? LINE_COLORS[i] : C.border}`, background: active ? LINE_COLORS[i] + "22" : "none", color: active ? LINE_COLORS[i] : C.inkLight }}>
                          {m.label}
                        </button>
                      ); })}
                    </div>
                  </div>
                  {filteredDashboard.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No sessions for this filter.</div>
                  ) : tab === "dashboard" ? (
                    <div className="chart-container">
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
                  ) : null}
                </div>
                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }} className="export-row">
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
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400 }}>Session History</h1>
                <button onClick={() => setShowUnitManager(true)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", letterSpacing: "0.05em" }}>MANAGE UNITS</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                {hospitals.length > 0 && <FilterBar value={historyHospitalFilter} onChange={v => { setHistoryHospitalFilter(v); setHistoryPage(20); }} label="HOSPITAL" hospitals={hospitals} />}
                {(isDirector || isVP) && regionRepNames.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>REP</span>
                    <select value={repFilter} onChange={e => { setRepFilter(e.target.value); setHistoryPage(20); }}
                      style={{ background: repFilter !== "All" ? C.primary : C.surface, border: `1px solid ${repFilter !== "All" ? C.primary : C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: repFilter !== "All" ? "white" : C.inkMid, cursor: "pointer", outline: "none", minHeight: 36 }}>
                      <option value="All">All Reps</option>
                      {regionRepNames.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {repFilter !== "All" && (
                      <button onClick={() => setRepFilter("All")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.inkLight, padding: "0 4px" }}>✕</button>
                    )}
                  </div>
                )}
                <DateRangeFilter />
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => { setHistorySearch(e.target.value); setHistoryPage(20); }}
                    placeholder="Search notes, hospital, unit..."
                    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 32px 8px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" }}
                    onFocus={e => e.target.style.borderColor = C.primary}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                  {historySearch
                    ? <button onClick={() => setHistorySearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.inkLight, fontSize: 14, lineHeight: 1 }}>✕</button>
                    : <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.inkFaint, fontSize: 13, pointerEvents: "none" }}>⌕</span>
                  }
                </div>
              </div>
            </div>
            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>Loading...</div>
            ) : filteredHistory.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No sessions found for this filter.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...filteredHistory].reverse().slice(0, historyPage).map(e => {
                  const isOfflinePending = e.id && String(e.id).startsWith("offline_");
                  const isEditing = editingId === e.id;
                  const ef = isEditing ? editForm : e;
                  const metrics = getMetrics(ef.hospital).map(m => ({ label: m.label, p: pct(ef[`${m.id}_num`], ef[`${m.id}_den`]), num: ef[`${m.id}_num`], den: ef[`${m.id}_den`] }));
                  const inpStyle = { background: C.bg, border: `1px solid ${C.primary}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, color: C.ink, width: "100%", outline: "none" };
                  return (
                    <div key={e.id} style={{ background: C.surface, border: `1px solid ${isEditing ? C.primary : C.border}`, borderRadius: 12, padding: "18px 20px", transition: "border-color 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }} className="history-card-top">
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
                          {!isEditing && e.notes && <div style={{ fontSize: 12, color: C.inkMid, maxWidth: 280, textAlign: "right", lineHeight: 1.5, fontStyle: "italic" }} className="history-notes">{e.notes}</div>}
                          <div style={{ display: "flex", gap: 6 }} className="history-actions">
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
                              <>
                                <button onClick={() => startEdit(e)}
                                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", letterSpacing: "0.05em" }}>
                                  EDIT
                                </button>
                                <button onClick={() => setPrintSession(e)}
                                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", letterSpacing: "0.05em" }}>
                                  PRINT
                                </button>
                                {!isOfflinePending && (
                                  e.deletion_requested
                                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 6, padding: "5px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.red, letterSpacing: "0.04em" }}>⏳ DELETION PENDING</span>
                                    : <button onClick={() => { setDeletionRequestModal({ session: e }); setDeletionRequestReason(""); }}
                                        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer", letterSpacing: "0.05em" }}>
                                        REQUEST DELETION
                                      </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {isEditing ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }} className="history-metric-grid history-metric-grid-edit">
                          {getMetrics(e.hospital).map(m => (
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }} className="history-metric-grid">
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

                      {/* View mode: inline thumbnails */}
                      {!isEditing && e.photos && e.photos.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>
                            PHOTOS · {e.photos.length}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {e.photos.map((url, i) => (
                              <div key={i} onClick={() => setExpandedPhotos(url)}
                                style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, cursor: "pointer", flexShrink: 0 }}>
                                <img src={url} alt={`Photo ${i + 1}`}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.15s" }}
                                  onMouseEnter={el => el.target.style.transform = "scale(1.06)"}
                                  onMouseLeave={el => el.target.style.transform = "scale(1)"} />
                                {e.photos.length > 1 && i === e.photos.length - 1 && (
                                  <div style={{ position: "absolute", inset: 0, background: "rgba(42,38,36,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ color: "white", fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>+{e.photos.length}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredHistory.length > historyPage && (
                  <button
                    onClick={() => { setHistoryPage(p => p + 20); haptic("light"); }}
                    style={{ width: "100%", padding: "14px", background: "none", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", letterSpacing: "0.06em" }}>
                    LOAD MORE ({filteredHistory.length - historyPage} remaining)
                  </button>
                )}
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

            {/* ── RANKINGS VIEW ── */}
            {(() => {
              // Build hospital rankings — use proxyEntries so director sees all region reps
              const perfEntries = ((isDirector || isVP) ? [...entries, ...regionEntries].filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i) : isKAM ? kamEntries : entries)
                .filter(e => (isDirector || isVP) && repFilter !== "All" ? e.logged_by === repFilter : true);              const hospitalMap = {};
              perfEntries.forEach(e => {
                if (!e.hospital || isTrialHospital(e.hospital)) return;
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
              perfEntries.forEach(e => {
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
                    <div style={{ background: C.bg, borderRadius: 8, marginBottom: 6, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                      {/* Top row: medal + name + score */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 }}>{showMedal ? medals[rank] : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkFaint }}>#{rankings.length - rank}</span>}</div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{item.name}</div>
                        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: pctColor(item.avg), flexShrink: 0 }}>{item.avg}%</div>
                      </div>
                      {/* Bottom row: sessions + trend + bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 38 }}>
                        <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, flexShrink: 0 }}>{item.sessions} session{item.sessions !== 1 ? "s" : ""}</div>
                        {item.trend !== null && (
                          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: trendColor, fontWeight: 600, flexShrink: 0 }}>
                            {trendIcon} {Math.abs(item.trend)}%
                          </div>
                        )}
                        <div style={{ flex: 1, height: 5, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${item.avg}%`, background: pctColor(item.avg), borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>{icon} {title} · {rankings.length} TOTAL</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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

                  {/* Territory Overview card */}
                  {hospitalRankings.length > 0 && (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>🗺  TERRITORY OVERVIEW</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                        {[
                          { label: "Hospitals", value: hospitalRankings.length, color: C.primary },
                          { label: "Total Sessions", value: entries.length, color: C.primary },
                          { label: "Territory Avg", value: (() => { const all = hospitalRankings.map(h => h.avg); return all.length ? Math.round(all.reduce((a,b) => a+b,0)/all.length) : null; })(), suffix: "%", color: (() => { const all = hospitalRankings.map(h => h.avg); const avg = all.length ? Math.round(all.reduce((a,b)=>a+b,0)/all.length) : null; return pctColor(avg); })() },
                          { label: "On Target", value: hospitalRankings.filter(h => h.avg >= 90).length, suffix: ` of ${hospitalRankings.length}`, color: C.green },
                        ].map(({ label, value, suffix = "", color }) => (
                          <div key={label} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginBottom: 6, letterSpacing: "0.06em" }}>{label.toUpperCase()}</div>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 700, color }}>{value !== null ? `${value}${suffix}` : "—"}</div>
                          </div>
                        ))}
                      </div>
                      {/* Hospital rows — compact card style */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {hospitalRankings.map((h, i) => (
                          <div key={h.name} onClick={() => { setHospitalFilter(h.name); setTab("dashboard"); }}
                            style={{ background: C.bg, borderRadius: 8, padding: "12px 14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Top row: rank + name + score */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkFaint, flexShrink: 0, width: 22 }}>#{i+1}</div>
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                              <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: pctColor(h.avg), flexShrink: 0 }}>{h.avg}%</div>
                            </div>
                            {/* Bottom row: sessions + trend + bar */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, flexShrink: 0 }}>{h.sessions} session{h.sessions !== 1 ? "s" : ""}</div>
                              {h.trend !== null && (
                                <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: h.trend > 0 ? C.green : h.trend < 0 ? C.red : C.inkLight, fontWeight: 600, flexShrink: 0 }}>
                                  {h.trend > 0 ? "▲" : h.trend < 0 ? "▼" : "–"} {Math.abs(h.trend)}%
                                </div>
                              )}
                              <div style={{ flex: 1, height: 5, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${h.avg}%`, background: pctColor(h.avg), borderRadius: 3 }} />
                              </div>
                              <div style={{ fontSize: 10, color: C.inkFaint, flexShrink: 0 }}>→</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint }}>Tap any hospital to open its dashboard</div>
                    </div>
                  )}

                  {/* Legend */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, flexShrink: 0 }}>TREND:</span>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.green }}>▲ Improving</span>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.red }}>▼ Declining</span>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint }}>– Insufficient data</span>
                  </div>
                  <RankingTable title="HOSPITALS" icon="🏥" rankings={hospitalRankings} />
                  <RankingTable title="LOCATIONS / UNITS" icon="📍" rankings={locationRankings} />
                </div>
              );
            })()}
          </div>
        )}

        {/* ── PLANNER ── */}
        {tab === "planner" && (() => {
          const perfEntries = ((isDirector || isVP) ? [...entries, ...regionEntries].filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i) : isKAM ? kamEntries : entries)
            .filter(e => (isDirector || isVP) && repFilter !== "All" ? e.logged_by === repFilter : true);
          const myName = user?.user_metadata?.full_name || user?.email || "";
          // KAM sees all sessions at their accounts; reps see only their own; directors/VPs see all region
          const relevantEntries = (isDirector || isVP) || isKAM ? perfEntries : perfEntries.filter(e => e.logged_by === myName);
          const today = new Date();

          const hospitalData = hospitals.filter(h => !isTrialHospital(h)).map(hospital => {
            const sessions = relevantEntries.filter(e => e.hospital === hospital && e.date);
            const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
            const lastSession = sorted[0];
            const days = lastSession ? Math.floor((today - (() => { const [y,m,d] = lastSession.date.split("-").map(Number); return new Date(y,m-1,d); })()) / 86400000) : null;
            const avgCompliance = (() => {
              const vals = METRICS.flatMap(m => sessions.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
              return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
            })();
            return { hospital, days, lastDate: lastSession?.date || null, avgCompliance, sessionCount: sessions.length };
          }).sort((a, b) => {
            if (a.days === null) return -1;
            if (b.days === null) return 1;
            return b.days - a.days;
          });

          const statusOf = (days) => {
            if (days === null) return { label: "NEVER VISITED", color: C.red, bg: C.redLight };
            if (days > 30) return { label: "OVERDUE", color: C.red, bg: C.redLight };
            if (days >= 20) return { label: "DUE SOON", color: C.amber, bg: C.amberLight };
            return { label: "ON TRACK", color: C.green, bg: C.greenLight };
          };

          const overdue = hospitalData.filter(h => h.days === null || h.days > 30);
          const dueSoon = hospitalData.filter(h => h.days !== null && h.days >= 20 && h.days <= 30);
          const onTrack = hospitalData.filter(h => h.days !== null && h.days < 20);

          const PlannerCard = ({ h }) => {
            const status = statusOf(h.days);
            return (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: status.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: C.ink, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.hospital}</div>
                  <div style={{ fontSize: 11, color: C.inkLight }}>
                    {h.lastDate
                      ? `Last visit ${new Date(h.lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${h.sessionCount} session${h.sessionCount !== 1 ? "s" : ""}`
                      : "No sessions logged yet"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <div style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}33`, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em" }}>{status.label}</div>
                  <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: status.color, fontWeight: 600 }}>
                    {h.days === null ? "—" : h.days === 0 ? "today" : h.days === 1 ? "yesterday" : `${h.days}d ago`}
                  </div>
                  {h.avgCompliance !== null && <div style={{ fontSize: 10, color: pctColor(h.avgCompliance), fontFamily: "'IBM Plex Mono', monospace" }}>{h.avgCompliance}% avg</div>}
                </div>
                <button onClick={() => { setForm(f => ({ ...f, hospital: h.hospital })); setTab("log"); haptic("light"); }}
                  style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 8, padding: "8px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", letterSpacing: "0.05em", flexShrink: 0 }}>
                  LOG →
                </button>
              </div>
            );
          };

          return (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>Visit Planner</h1>
                <p style={{ color: C.inkMid, fontSize: 13 }}>Hospitals sorted by days since last visit. Tap LOG → to start a session.</p>
              </div>

              {/* Summary strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
                {[
                  { label: "Overdue", value: overdue.length, color: C.red, bg: C.redLight },
                  { label: "Due Soon", value: dueSoon.length, color: C.amber, bg: C.amberLight },
                  { label: "On Track", value: onTrack.length, color: C.green, bg: C.greenLight },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color, letterSpacing: "0.1em", marginTop: 4 }}>{label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              {overdue.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red, letterSpacing: "0.1em", marginBottom: 10 }}>OVERDUE · {overdue.length}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{overdue.map(h => <PlannerCard key={h.hospital} h={h} />)}</div>
                </div>
              )}
              {dueSoon.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.1em", marginBottom: 10 }}>DUE SOON · {dueSoon.length}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{dueSoon.map(h => <PlannerCard key={h.hospital} h={h} />)}</div>
                </div>
              )}
              {onTrack.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green, letterSpacing: "0.1em", marginBottom: 10 }}>ON TRACK · {onTrack.length}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{onTrack.map(h => <PlannerCard key={h.hospital} h={h} />)}</div>
                </div>
              )}
              {hospitalData.length === 0 && (
                <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No hospitals logged yet.</div>
              )}
            </div>
          );
        })()}

        {tab === "region" && (isDirector || isVP || isAdmin) && (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary, letterSpacing: "0.12em", marginBottom: 4 }}>{(isVP || isAdmin) ? "ALL REGIONS" : "MY REGION"}</div>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>{(isVP || isAdmin) ? "All Regions" : (myRegion || "Region")}</h1>
              <p style={{ color: C.inkMid, fontSize: 13 }}>{(isAdmin ? userProfiles.filter(p => !ADMIN_EMAILS.includes(p.email) && p.role !== 'vp' && p.role !== 'director') : regionReps).length} rep{regionReps.length !== 1 ? "s" : ""} · {(isAdmin ? allEntriesFull : regionEntries).length} sessions logged</p>
            </div>

            {regionLoading && !isAdmin ? (
              <div style={{ fontSize: 13, color: C.inkLight, padding: "40px 0", textAlign: "center" }}>Loading region data...</div>
            ) : (() => {
              const tabReps = isAdmin
                ? userProfiles.filter(p => !ADMIN_EMAILS.includes(p.email) && p.role !== 'vp' && p.role !== 'director' && p.is_active !== false)
                : regionReps;
              const tabEntries = isAdmin ? allEntriesFull : regionEntries;
              if (tabReps.length === 0) return (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 8 }}>No reps found</div>
                  <div style={{ fontSize: 13, color: C.inkMid }}>No reps have been assigned yet.</div>
                </div>
              );
              return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ── Rep Session Comparison Chart ── */}
                {tabEntries.length > 0 && (() => {
                  const now = new Date();
                  const chartMode = repChartMode;
                  const setChartMode = setRepChartMode;
                  const chartPeriod = repChartPeriod;
                  const setChartPeriod = setRepChartPeriod;

                  const filterByPeriod = (sessions) => {
                    if (chartPeriod === "month") {
                      const m = now.getMonth(), y = now.getFullYear();
                      return sessions.filter(e => { if (!e.date) return false; const [ey, em] = e.date.split("-").map(Number); return em - 1 === m && ey === y; });
                    }
                    if (chartPeriod === "90d") {
                      return sessions.filter(e => { if (!e.date) return false; const [ey, em, ed] = e.date.split("-").map(Number); return (now - new Date(ey, em-1, ed)) / 86400000 <= 90; });
                    }
                    return sessions;
                  };

                  const bedsAudited = (sessions) => sessions.reduce((sum, e) => {
                    if (e.bed_data && e.bed_data.length > 0) return sum + e.bed_data.length;
                    return sum + (parseInt(e.matt_applied_den) || 0);
                  }, 0);

                  const chartData = tabReps.map(rep => {
                    const name = rep.full_name || rep.email;
                    const repSessions = filterByPeriod(tabEntries.filter(e => e.logged_by === name));
                    const shortName = name.split(" ")[0];
                    return { name: shortName, fullName: name, sessions: repSessions.length, beds: bedsAudited(repSessions) };
                  }).sort((a, b) => b[chartMode] - a[chartMode]);

                  const maxVal = Math.max(...chartData.map(d => d[chartMode]), 1);

                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em" }}>REP COMPARISON</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[["sessions","SESSIONS"],["beds","PT BEDS"]].map(([val, label]) => (
                            <button key={val} onClick={() => setChartMode(val)}
                              style={{ background: chartMode === val ? C.primary : "none", border: `1px solid ${chartMode === val ? C.primary : C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: chartMode === val ? "white" : C.inkLight, cursor: "pointer", letterSpacing: "0.05em" }}>
                              {label}
                            </button>
                          ))}
                          <div style={{ width: 1, background: C.border, margin: "0 2px" }} />
                          {[["all","ALL"],["month","MTH"],["90d","90D"]].map(([val, label]) => (
                            <button key={val} onClick={() => setChartPeriod(val)}
                              style={{ background: chartPeriod === val ? C.primaryLight : "none", border: `1px solid ${chartPeriod === val ? C.primary : C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: chartPeriod === val ? C.primary : C.inkLight, cursor: "pointer", letterSpacing: "0.05em" }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bar chart */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {chartData.map((d, i) => {
                          const val = d[chartMode];
                          const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                          return (
                            <div key={d.fullName} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 90, fontSize: 11, color: C.inkLight, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.fullName}>{d.name}</div>
                              <div style={{ flex: 1, height: 28, background: C.bg, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                                <div style={{ height: "100%", width: `${barPct}%`, background: C.primary, borderRadius: 4, transition: "width 0.5s ease", minWidth: val > 0 ? 4 : 0 }} />
                                <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 500, color: barPct > 50 ? "white" : C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                                  {val > 0 ? val : "—"}
                                </div>
                              </div>
                              {i === 0 && <div style={{ width: 16, fontSize: 12 }}>🥇</div>}
                              {i === 1 && <div style={{ width: 16, fontSize: 12 }}>🥈</div>}
                              {i === 2 && <div style={{ width: 16, fontSize: 12 }}>🥉</div>}
                              {i > 2 && <div style={{ width: 16 }} />}
                            </div>
                          );
                        })}
                      </div>
                      {chartData.every(d => d[chartMode] === 0) && (
                        <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: C.inkLight }}>No data for this period.</div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Regional Aggregated Metrics ── */}
                {tabEntries.length > 0 && (() => {
                  const regionAvgByMetric = METRICS.map(m => {
                    const vals = tabEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
                    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                    return { ...m, avg };
                  });
                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>REGIONAL COMPLIANCE — ALL REPS</div>
                      {METRIC_BUCKETS.map(bucket => {
                        const bucketMetrics = regionAvgByMetric.filter(m => bucket.ids.includes(m.id));
                        if (bucketMetrics.length === 0) return null;
                        return (
                          <div key={bucket.label} style={{ marginBottom: 20 }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 8 }}>{bucket.label.toUpperCase()}</div>
                            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(bucketMetrics.length, 4)}, 1fr)`, gap: 10 }} className="metric-grid">
                              {bucketMetrics.map(m => {
                                const natVals = allEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
                                const natAvg = natVals.length ? Math.round(natVals.reduce((a,b)=>a+b,0)/natVals.length) : null;
                                return (
                                <div key={m.id} style={{ background: m.avg !== null ? (m.avg >= 90 ? C.greenLight : m.avg >= 70 ? C.amberLight : C.redLight) : C.bg, border: `1px solid ${m.avg !== null ? pctColor(m.avg) + "44" : C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                                  <div style={{ fontSize: 11, color: C.inkLight, lineHeight: 1.4, marginBottom: 8 }}>{m.label}</div>
                                  <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 700, color: m.avg !== null ? pctColor(m.avg) : C.inkFaint }}>{m.avg !== null ? `${m.avg}%` : "—"}</div>
                                  <div style={{ marginTop: 6, height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${m.avg ?? 0}%`, background: m.avg !== null ? pctColor(m.avg) : C.inkFaint, borderRadius: 2, transition: "width 0.6s ease" }} />
                                  </div>
                                  {natAvg !== null && (
                                    <div style={{ marginTop: 6, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint }}>
                                      National avg: {natAvg}%
                                      {m.avg !== null && <span style={{ marginLeft: 6, fontWeight: 600, color: m.avg >= natAvg ? C.green : C.red }}>{m.avg >= natAvg ? "▲" : "▼"}{Math.abs(m.avg - natAvg)}%</span>}
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── Hospital Rankings across region ── */}
                {tabEntries.length > 0 && (() => {
                  const hospMap = {};
                  tabEntries.forEach(e => {
                    if (!e.hospital) return;
                    if (!hospMap[e.hospital]) hospMap[e.hospital] = [];
                    hospMap[e.hospital].push(e);
                  });
                  const rankings = Object.entries(hospMap).map(([hosp, sess]) => {
                    const vals = METRICS.flatMap(m => sess.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                    return { name: hosp, avg, sessions: sess.length };
                  }).filter(h => h.avg !== null).sort((a, b) => b.avg - a.avg);
                  if (rankings.length === 0) return null;
                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>HOSPITAL RANKINGS — REGION</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {rankings.map((h, i) => (
                          <div key={h.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < rankings.length - 1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ width: 24, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.inkFaint, flexShrink: 0 }}>#{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                              <div style={{ fontSize: 10, color: C.inkLight, marginTop: 1 }}>{h.sessions} session{h.sessions !== 1 ? "s" : ""}</div>
                            </div>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: pctColor(h.avg), flexShrink: 0 }}>{h.avg}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
            </div>

            {/* Admin sub-nav */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 24, gap: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {[["sessions","ALL SESSIONS"],["deletions","DELETION REQUESTS"],["users","USER MANAGEMENT"],["hospitals","HOSPITALS"],["auto_reports","AUTO REPORTS"],["audit","AUDIT LOG"]].map(([id, label]) => {
                const pendingCount = id === "deletions" ? allEntriesFull.filter(e => e.deletion_requested).length : id === "users" ? userProfiles.filter(p => p.pending_approval).length : 0;
                return (
                  <button key={id} onClick={() => setAdminSection(id)}
                    style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.06em", color: adminSection === id ? C.primary : C.inkLight, borderBottom: adminSection === id ? `2px solid ${C.primary}` : "2px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    {label}
                    {pendingCount > 0 && <span style={{ background: C.red, color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>{pendingCount}</span>}
                  </button>
                );
              })}
            </div>

            {/* Stats row - always visible */}
            {(() => {
              const now = new Date();
              const todayStr = now.toISOString().slice(0, 10);
              const thisMonth = now.getMonth();
              const thisYear = now.getFullYear();
              const todaySessions = allEntriesFull.filter(e => e.date === todayStr).length;
              const monthSessions = allEntriesFull.filter(e => {
                if (!e.date) return false;
                const [y, m] = e.date.split("-").map(Number);
                return m - 1 === thisMonth && y === thisYear;
              }).length;
              const orgAvg = (() => {
                const vals = METRICS.flatMap(m => allEntriesFull.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
                return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
              })();
              const activeReps = userProfiles.filter(u => u.is_active !== false && !ADMIN_EMAILS.includes(u.email)).length;
              const monthName = now.toLocaleString("en-US", { month: "long" });

              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }} className="admin-stats-grid">
                    {[
                      { label: "Sessions Today", value: todaySessions, sub: todayStr, color: todaySessions > 0 ? C.green : C.inkLight },
                      { label: `${monthName} Sessions`, value: monthSessions, sub: `${allEntriesFull.length} all time`, color: C.primary },
                      { label: "Active Users", value: activeReps, sub: `${userProfiles.length} total registered`, color: C.primary },
                      { label: "Org Avg Compliance", value: orgAvg !== null ? `${orgAvg}%` : "—", sub: "across all sessions", color: orgAvg !== null ? pctColor(orgAvg) : C.inkLight },
                    ].map(s => (
                      <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                        <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 8 }}>{s.label.toUpperCase()}</div>
                        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 6 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Bulk export row */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.08em", marginBottom: 4 }}>BULK EXPORT</div>
                      <div style={{ fontSize: 12, color: C.inkMid }}>Export all sessions to Excel for reporting to HoverTech leadership</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[
                        { label: "ALL TIME", filter: null },
                        { label: `${monthName.toUpperCase()} ONLY`, filter: "month" },
                        { label: "LAST 90 DAYS", filter: "90d" },
                      ].map(({ label, filter }) => (
                        <button key={label} onClick={() => {
                          const filtered = filter === "month"
                            ? allEntriesFull.filter(e => { if (!e.date) return false; const [y, m] = e.date.split("-").map(Number); return m - 1 === thisMonth && y === thisYear; })
                            : filter === "90d"
                              ? allEntriesFull.filter(e => { if (!e.date) return false; const [y, m, d] = e.date.split("-").map(Number); return (now - new Date(y, m-1, d)) / 86400000 <= 90; })
                              : allEntriesFull;

                          const XLSX = window.XLSX || (typeof require !== "undefined" ? require("xlsx") : null);
                          import("xlsx").then(XLSX => {
                            const rows = filtered.map(e => ({
                              Date: e.date || "",
                              Hospital: e.hospital || "",
                              "Location / Unit": e.location || "",
                              "Protocol for Use": e.protocol_for_use || "",
                              "Logged By": e.logged_by || "",
                              "Created At": e.created_at ? new Date(e.created_at).toLocaleString() : "",
                              "Turning & Repo Num": e.turning_criteria_num ?? "",
                              "Turning & Repo Den": e.turning_criteria_den ?? "",
                              "Matt Applied Num": e.matt_applied_num ?? "",
                              "Matt Applied Den": e.matt_applied_den ?? "",
                              "Matt Properly Num": e.matt_proper_num ?? "",
                              "Matt Properly Den": e.matt_proper_den ?? "",
                              "Wedges In Room Num": e.wedges_in_room_num ?? "",
                              "Wedges In Room Den": e.wedges_in_room_den ?? "",
                              "Wedges Applied Num": e.wedges_applied_num ?? "",
                              "Wedges Applied Den": e.wedges_applied_den ?? "",
                              "Wedge Offload Num": e.wedge_offload_num ?? "",
                              "Wedge Offload Den": e.wedge_offload_den ?? "",
                              "Air Supply Num": e.air_supply_num ?? "",
                              "Air Supply Den": e.air_supply_den ?? "",
                              "Notes": e.notes || "",
                            }));
                            const ws = XLSX.utils.json_to_sheet(rows);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, "Sessions");
                            const dateStr = now.toISOString().slice(0, 10);
                            XLSX.writeFile(wb, `CareTrack_BulkExport_${label.replace(/\s/g,"_")}_${dateStr}.xlsx`);
                          }).catch(() => alert("Export failed. Please try again."));
                        }}
                        style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 8, padding: "8px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: "pointer", letterSpacing: "0.05em" }}>
                          ↓ {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── SESSIONS SECTION ── */}
            {adminSection === "sessions" && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em" }}>ALL SESSIONS ({allEntriesFull.length})</div>
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

            {/* ── DELETION REQUESTS SECTION ── */}
            {adminSection === "deletions" && (() => {
              const pending = [...allEntriesFull].filter(e => e.deletion_requested).reverse();
              return (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>DELETION REQUESTS ({pending.length})</div>
                  {pending.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: C.inkLight, fontSize: 13 }}>No pending deletion requests.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {pending.map(e => {
                        const overallVals = METRICS.map(m => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
                        const overall = overallVals.length ? Math.round(overallVals.reduce((a,b)=>a+b,0)/overallVals.length) : null;
                        return (
                          <div key={e.id} style={{ background: C.redLight, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{e.date}{e.hospital ? <span style={{ color: C.primary }}> · {e.hospital}</span> : ""}</div>
                                <div style={{ fontSize: 11, color: C.inkMid, marginTop: 2 }}>{e.location && `${e.location} · `}{formatTimestamp(e.created_at)}</div>
                                {e.logged_by && <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, background: C.primaryLight, border: `1px solid ${C.primary}22`, borderRadius: 20, padding: "2px 10px" }}><span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary }}>{e.logged_by}</span></div>}
                                {e.deletion_reason && <div style={{ marginTop: 8, fontSize: 12, color: C.inkMid, background: "white", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", fontStyle: "italic" }}>"{e.deletion_reason}"</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: overall !== null ? pctColor(overall) : C.inkFaint, marginRight: 4 }}>{overall !== null ? `${overall}%` : "—"}</div>
                                <button onClick={() => handleDenyDeletion(e.id)}
                                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", letterSpacing: "0.04em" }}>DENY</button>
                                <button onClick={() => { if (window.confirm(`Permanently delete this session from ${e.hospital} on ${e.date}?`)) handleApproveDeletion(e.id); }}
                                  style={{ background: C.red, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.04em" }}>APPROVE & DELETE</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── USER MANAGEMENT SECTION ── */}
            {adminSection === "users" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Pending Approval Queue */}
                {(() => {
                  const pending = userProfiles.filter(p => p.pending_approval === true);
                  if (pending.length === 0) return null;
                  return (
                    <div style={{ background: C.surface, border: `2px solid ${C.amber}44`, borderRadius: 12, padding: "24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.1em" }}>PENDING APPROVAL · {pending.length}</div>
                        <div style={{ background: C.amber, color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 9, fontWeight: 700 }}>{pending.length}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {pending.map(p => (
                          <div key={p.id} style={{ background: C.amberLight, border: `1px solid ${C.amber}33`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{p.full_name || "—"}</div>
                              <div style={{ fontSize: 12, color: C.inkLight, marginTop: 2 }}>{p.email}</div>
                              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                <span style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: C.primary, fontFamily: "'IBM Plex Mono', monospace" }}>{(p.role || "rep").toUpperCase()}</span>
                                {p.region && <span style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace" }}>{p.region}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={async () => {
                                await supabase.from("user_profiles").update({ is_active: true, pending_approval: false }).eq("id", p.id);
                                setUserProfiles(prev => prev.map(u => u.id === p.id ? { ...u, is_active: true, pending_approval: false } : u));
                                await logAudit("USER_APPROVED", { email: p.email, name: p.full_name });
                                // Send approval email
                                try {
                                  await fetch("https://okswecmkqegydbxsczjc.supabase.co/functions/v1/notify-admin-signup", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "approve", name: p.full_name, email: p.email }),
                                  });
                                } catch (_) {}
                              }}
                                style={{ background: C.green, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em" }}>
                                ✓ APPROVE
                              </button>
                              <button onClick={async () => {
                                if (!window.confirm(`Reject and delete account for ${p.full_name || p.email}?`)) return;
                                await supabase.from("user_profiles").delete().eq("id", p.id);
                                await supabase.auth.admin?.deleteUser(p.id);
                                setUserProfiles(prev => prev.filter(u => u.id !== p.id));
                                await logAudit("USER_REJECTED", { email: p.email, name: p.full_name });
                                try {
                                  await fetch("https://okswecmkqegydbxsczjc.supabase.co/functions/v1/notify-admin-signup", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "reject", name: p.full_name, email: p.email }),
                                  });
                                } catch (_) {}
                              }}
                                style={{ background: "none", border: `1px solid ${C.red}`, borderRadius: 8, padding: "8px 16px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer", letterSpacing: "0.05em" }}>
                                ✕ REJECT
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Invite User card */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>INVITE USER</div>
                  <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 20, lineHeight: 1.6 }}>Send a branded invitation email. The user will be prompted to set their password on first login.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>FULL NAME</label>
                      <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Jane Smith"
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" }}
                        onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>EMAIL ADDRESS</label>
                      <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="jane@hospital.com"
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" }}
                        onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>ROLE</label>
                      <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer" }}>
                        <option value="rep">Rep</option>
                        <option value="kam">KAM</option>
                        <option value="director">Director</option>
                        <option value="vp">VP</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>REGION <span style={{ color: C.inkFaint }}>(optional)</span></label>
                      <input value={inviteRegion} onChange={e => setInviteRegion(e.target.value)} placeholder="e.g. Northeast"
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" }}
                        onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                  {inviteResult && (
                    <div style={{ background: inviteResult.ok ? C.greenLight : C.redLight, border: `1px solid ${inviteResult.ok ? C.green : C.red}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: inviteResult.ok ? C.green : C.red, marginBottom: 16 }}>
                      {inviteResult.ok ? "✓" : "⚠"} {inviteResult.message}
                    </div>
                  )}
                  <button disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
                    onClick={async () => {
                      if (!inviteEmail.trim() || !inviteName.trim()) return;
                      setInviting(true); setInviteResult(null);
                      try {
                        // Use Supabase Edge Function to call auth.admin.inviteUserByEmail with service role
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/invite-user`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
                          body: JSON.stringify({ email: inviteEmail.trim(), full_name: inviteName.trim(), role: inviteRole, region: inviteRegion.trim() }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || "Invitation failed");
                        setInviteResult({ ok: true, message: `Invitation sent to ${inviteEmail.trim()}` });
                        await logAudit("USER_INVITED", { email: inviteEmail.trim(), name: inviteName.trim() }, inviteEmail.trim());
                        const { data: freshAudit } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
                        if (freshAudit) setAuditLog(freshAudit);
                        setInviteEmail(""); setInviteName(""); setInviteRole("rep"); setInviteRegion("");
                      } catch (err) {
                        setInviteResult({ ok: false, message: err.message });
                      }
                      setInviting(false);
                    }}
                    style={{ background: inviting || !inviteEmail.trim() || !inviteName.trim() ? C.surfaceAlt : C.primary, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: inviting || !inviteEmail.trim() || !inviteName.trim() ? C.inkLight : "white", cursor: inviting || !inviteEmail.trim() || !inviteName.trim() ? "not-allowed" : "pointer", letterSpacing: "0.08em" }}>
                    {inviting ? "SENDING..." : "SEND INVITATION →"}
                  </button>
                </div>
                {/* Org Health Summary */}
                {(() => {
                  const now = new Date();
                  const activeUsers = userProfiles.filter(u => u.is_active !== false && !ADMIN_EMAILS.includes(u.email) && !u.pending_approval);
                  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
                  const sixtyDaysAgo = new Date(now - 60 * 86400000).toISOString();
                  const recentlyActive = activeUsers.filter(u => u.last_login && u.last_login > thirtyDaysAgo).length;
                  const atRisk = activeUsers.filter(u => !u.last_login || u.last_login < sixtyDaysAgo).length;
                  const onboarded = activeUsers.filter(u => allEntriesFull.some(e => e.logged_by === u.full_name || e.logged_by === u.email)).length;
                  const thisMonth = now.getMonth(), thisYear = now.getFullYear();
                  const coverageGaps = [...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].filter(h => {
                    const recent = allEntriesFull.filter(e => e.hospital === h && e.date);
                    const lastDate = recent.sort((a,b) => b.date.localeCompare(a.date))[0]?.date;
                    if (!lastDate) return true;
                    const [y, m, d] = lastDate.split("-").map(Number);
                    return (now - new Date(y, m-1, d)) / 86400000 > 45;
                  }).length;

                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 14 }}>ORG HEALTH</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="admin-stats-grid">
                        {[
                          { label: "Active last 30d", value: recentlyActive, total: activeUsers.length, color: recentlyActive === activeUsers.length ? C.green : C.amber },
                          { label: "At risk (60d+)", value: atRisk, total: activeUsers.length, color: atRisk === 0 ? C.green : C.red },
                          { label: "Onboarded", value: onboarded, total: activeUsers.length, color: onboarded === activeUsers.length ? C.green : C.amber },
                          { label: "Coverage gaps", value: coverageGaps, total: null, color: coverageGaps === 0 ? C.green : C.amber },
                        ].map(s => (
                          <div key={s.label} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                            <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.06em", marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 700, color: s.color }}>
                              {s.value}{s.total !== null ? <span style={{ fontSize: 13, color: C.inkLight, fontWeight: 400 }}>/{s.total}</span> : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
                      const now = new Date();

                      // Last login
                      const lastLogin = profile.last_login ? new Date(profile.last_login) : null;
                      const daysSinceLogin = lastLogin ? Math.floor((now - lastLogin) / 86400000) : null;
                      const lastLoginLabel = daysSinceLogin === null ? "Never logged in" : daysSinceLogin === 0 ? "Today" : daysSinceLogin === 1 ? "Yesterday" : `${daysSinceLogin}d ago`;
                      const loginColor = daysSinceLogin === null ? C.red : daysSinceLogin <= 7 ? C.green : daysSinceLogin <= 30 ? C.amber : C.red;

                      // Session frequency score
                      const now30 = new Date(now - 30 * 86400000).toISOString().slice(0,10);
                      const sessionsThisMonth = userSessions.filter(e => e.date >= now30).length;
                      const freqColor = sessionsThisMonth >= 4 ? C.green : sessionsThisMonth >= 1 ? C.amber : C.red;
                      const freqLabel = sessionsThisMonth >= 4 ? "Active" : sessionsThisMonth >= 1 ? "Slowing" : "Inactive";

                      // Account age
                      const createdAt = profile.created_at ? new Date(profile.created_at) : null;
                      const accountAgeDays = createdAt ? Math.floor((now - createdAt) / 86400000) : null;
                      const accountAgeLabel = accountAgeDays === null ? "" : accountAgeDays < 7 ? "New user" : accountAgeDays < 30 ? `${accountAgeDays}d old` : accountAgeDays < 365 ? `${Math.floor(accountAgeDays/30)}mo` : `${Math.floor(accountAgeDays/365)}yr`;

                      return (
                      <div key={profile.id} style={{ background: isActive ? C.bg : C.redLight, borderRadius: 10, padding: "14px 16px", border: `1px solid ${isActive ? C.border : "#f0c8c8"}`, opacity: isActive ? 1 : 0.7 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="user-card-row">
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: isAdminUser ? C.accentLight : C.primaryLight, border: `1px solid ${isAdminUser ? C.accent : C.primary}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: isAdminUser ? C.accent : C.primary, flexShrink: 0 }}>
                              {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                {editingNameId === profile.id ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                                    <input
                                      autoFocus
                                      value={editingNameValue}
                                      onChange={e => setEditingNameValue(e.target.value)}
                                      onKeyDown={async e => {
                                        if (e.key === "Escape") { setEditingNameId(null); setEditingNameValue(""); }
                                        if (e.key === "Enter") {
                                          if (!editingNameValue.trim() || editingNameValue.trim() === profile.full_name) { setEditingNameId(null); return; }
                                          setEditingNameSaving(true);
                                          const oldName = profile.full_name || profile.email;
                                          const newName = editingNameValue.trim();
                                          const { error: profErr } = await supabase.from("user_profiles").update({ full_name: newName }).eq("id", profile.id);
                                          if (profErr) { alert("Failed: " + profErr.message); setEditingNameSaving(false); return; }
                                          await supabase.from("sessions").update({ logged_by: newName }).eq("logged_by", oldName);
                                          setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, full_name: newName } : p));
                                          setAllEntriesFull(prev => prev.map(e => e.logged_by === oldName ? { ...e, logged_by: newName } : e));
                                          setEntries(prev => prev.map(e => e.logged_by === oldName ? { ...e, logged_by: newName } : e));
                                          await logAudit("USER_RENAMED", { email: profile.email, from: oldName, to: newName }, profile.email);
                                          setEditingNameId(null); setEditingNameValue(""); setEditingNameSaving(false);
                                        }
                                      }}
                                      style={{ flex: 1, background: C.bg, border: `1px solid ${C.primary}`, borderRadius: 6, padding: "3px 8px", fontSize: 13, color: C.ink, fontFamily: "'IBM Plex Sans', sans-serif", minWidth: 0, outline: "none" }}
                                    />
                                    <button onClick={async () => {
                                      if (!editingNameValue.trim() || editingNameValue.trim() === profile.full_name) { setEditingNameId(null); return; }
                                      setEditingNameSaving(true);
                                      const oldName = profile.full_name || profile.email;
                                      const newName = editingNameValue.trim();
                                      const { error: profErr } = await supabase.from("user_profiles").update({ full_name: newName }).eq("id", profile.id);
                                      if (profErr) { alert("Failed: " + profErr.message); setEditingNameSaving(false); return; }
                                      await supabase.from("sessions").update({ logged_by: newName }).eq("logged_by", oldName);
                                      setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, full_name: newName } : p));
                                      setAllEntriesFull(prev => prev.map(e => e.logged_by === oldName ? { ...e, logged_by: newName } : e));
                                      setEntries(prev => prev.map(e => e.logged_by === oldName ? { ...e, logged_by: newName } : e));
                                      await logAudit("USER_RENAMED", { email: profile.email, from: oldName, to: newName }, profile.email);
                                      setEditingNameId(null); setEditingNameValue(""); setEditingNameSaving(false);
                                    }} disabled={editingNameSaving}
                                      style={{ background: C.green, border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      {editingNameSaving ? "..." : "SAVE"}
                                    </button>
                                    <button onClick={() => { setEditingNameId(null); setEditingNameValue(""); }}
                                      style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{profile.full_name || profile.email}</div>
                                    {isAdminUser && <span style={{ fontSize: 9, background: C.accentLight, color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>ADMIN</span>}
                                    {profile.role === "director" && <span style={{ fontSize: 9, background: C.primaryLight, color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>DIRECTOR</span>}
                                    {profile.role === "vp" && <span style={{ fontSize: 9, background: C.accentLight, color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>VP</span>}
                                    {profile.role === "kam" && <span style={{ fontSize: 9, background: C.amberLight, color: C.amber, border: `1px solid ${C.amber}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>KAM</span>}
                                    {profile.region && <span style={{ fontSize: 9, background: C.surfaceAlt, color: C.inkMid, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>{profile.region}</span>}
                                    {!isActive && <span style={{ fontSize: 9, background: C.redLight, color: C.red, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>DEACTIVATED</span>}
                                    {accountAgeLabel && <span style={{ fontSize: 9, color: C.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>{accountAgeLabel}</span>}
                                    <button onClick={() => { setEditingNameId(profile.id); setEditingNameValue(profile.full_name || ""); }}
                                      style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "1px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", letterSpacing: "0.04em" }}>
                                      ✎ RENAME
                                    </button>
                                  </>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {profile.email} · {userSessions.length} session{userSessions.length !== 1 ? "s" : ""}
                                {lastSession && ` · Last session: ${formatTimestamp(lastSession.created_at, lastSession.date)}`}
                              </div>
                              {/* Health indicators row */}
                              {!isAdminUser && (
                                <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: loginColor, flexShrink: 0, display: "inline-block" }} />
                                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: loginColor }}>LOGIN: {lastLoginLabel}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: freqColor, flexShrink: 0, display: "inline-block" }} />
                                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: freqColor }}>{freqLabel.toUpperCase()} · {sessionsThisMonth} session{sessionsThisMonth !== 1 ? "s" : ""}/30d</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: "right", marginRight: 8, flexShrink: 0 }}>
                              <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: overall !== null ? pctColor(overall) : C.inkFaint }}>{overall !== null ? `${overall}%` : "—"}</div>
                              <div style={{ fontSize: 10, color: C.inkLight }}>avg compliance</div>
                            </div>
                            {!isAdminUser && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }} className="user-actions">
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
                                <button onClick={() => { setViewAsUser({ email: profile.email, full_name: profile.full_name }); setTab("dashboard"); }}
                                  style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkMid, cursor: "pointer", whiteSpace: "nowrap" }}>
                                  👁 VIEW AS
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Role + Region + Notes row */}
                          {!isAdminUser && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>ROLE</label>
                                  <select value={profile.role || "rep"}
                                    onChange={async e => {
                                      const newRole = e.target.value;
                                      const { error } = await supabase.from("user_profiles").update({ role: newRole }).eq("id", profile.id);
                                      if (error) { alert("Failed: " + error.message); return; }
                                      setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p));
                                      await logAudit("USER_ROLE_CHANGED", { email: profile.email, role: newRole }, profile.email);
                                    }}
                                    style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: C.ink, outline: "none", cursor: "pointer" }}>
                                    <option value="rep">Rep</option>
                                    <option value="kam">KAM</option>
                                    <option value="director">Director</option>
                                    <option value="vp">VP</option>
                                  </select>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 140 }}>
                                  <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>REGION</label>
                                  <input
                                    defaultValue={profile.region || ""}
                                    placeholder="e.g. Northeast"
                                    onBlur={async e => {
                                      const newRegion = e.target.value.trim();
                                      if (newRegion === (profile.region || "")) return;
                                      const { error } = await supabase.from("user_profiles").update({ region: newRegion }).eq("id", profile.id);
                                      if (error) { alert("Failed: " + error.message); return; }
                                      setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, region: newRegion } : p));
                                      await logAudit("USER_REGION_CHANGED", { email: profile.email, region: newRegion }, profile.email);
                                    }}
                                    style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" }}
                                    onFocus={e => e.target.style.borderColor = C.primary}
                                    onKeyDown={e => e.key === "Enter" && e.target.blur()}
                                  />
                                </div>
                              </div>
                              {/* Rep Notes */}
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", whiteSpace: "nowrap", paddingTop: 5 }}>NOTES</label>
                                <input
                                  defaultValue={profile.notes || ""}
                                  placeholder="e.g. On leave, new hire, key account manager..."
                                  onBlur={async e => {
                                    const newNotes = e.target.value.trim();
                                    if (newNotes === (profile.notes || "")) return;
                                    const { error } = await supabase.from("user_profiles").update({ notes: newNotes }).eq("id", profile.id);
                                    if (error) { alert("Failed: " + error.message); return; }
                                    setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, notes: newNotes } : p));
                                  }}
                                  style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif" }}
                                  onFocus={e => e.target.style.borderColor = C.primary}
                                  onKeyDown={e => e.key === "Enter" && e.target.blur()}
                                />
                              </div>
                            </div>
                          )}
                          {/* KAM accounts assignment */}
                          {profile.role === "kam" && (() => {
                            const allHospitals = [...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort();
                            const assigned = profile.accounts || [];
                            return (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>
                                  ASSIGNED ACCOUNTS · {assigned.length}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                  {assigned.map(hosp => (
                                    <div key={hosp} style={{ display: "flex", alignItems: "center", gap: 4, background: C.amberLight, border: `1px solid ${C.amber}33`, borderRadius: 6, padding: "2px 8px" }}>
                                      <span style={{ fontSize: 11, color: C.amber }}>{hosp}</span>
                                      <button onClick={async () => {
                                        const newAccounts = assigned.filter(h => h !== hosp);
                                        const { error } = await supabase.from("user_profiles").update({ accounts: newAccounts }).eq("id", profile.id);
                                        if (error) { alert("Failed: " + error.message); return; }
                                        setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, accounts: newAccounts } : p));
                                        await logAudit("KAM_ACCOUNT_REMOVED", { email: profile.email, hospital: hosp }, profile.email);
                                      }} style={{ background: "none", border: "none", cursor: "pointer", color: C.amber, fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
                                    </div>
                                  ))}
                                  {assigned.length === 0 && <span style={{ fontSize: 11, color: C.inkFaint, fontStyle: "italic" }}>No accounts assigned yet</span>}
                                </div>
                                <select
                                  value=""
                                  onChange={async e => {
                                    const hosp = e.target.value;
                                    if (!hosp || assigned.includes(hosp)) return;
                                    const newAccounts = [...assigned, hosp];
                                    const { error } = await supabase.from("user_profiles").update({ accounts: newAccounts }).eq("id", profile.id);
                                    if (error) { alert("Failed: " + error.message); return; }
                                    setUserProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, accounts: newAccounts } : p));
                                    await logAudit("KAM_ACCOUNT_ASSIGNED", { email: profile.email, hospital: hosp }, profile.email);
                                  }}
                                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: C.inkMid, outline: "none", cursor: "pointer", maxWidth: 260 }}>
                                  <option value="">+ Add account...</option>
                                  {allHospitals.filter(h => !assigned.includes(h)).map(h => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    {userProfiles.length === 0 && <div style={{ fontSize: 13, color: C.inkLight, padding: "20px 0" }}>No users registered yet.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── HOSPITALS SECTION ── */}
            {adminSection === "hospitals" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Rename Hospital card */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>RENAME HOSPITAL</div>
                  <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 20, lineHeight: 1.6 }}>Renames a hospital across all sessions. The new name will appear in rep dropdowns automatically.</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>CURRENT NAME</label>
                      <select
                        value={hospitalRenameFrom}
                        onChange={e => { setHospitalRenameFrom(e.target.value); setHospitalRenameResult(null); }}
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: hospitalRenameFrom ? C.ink : C.inkLight, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        <option value="">Select hospital...</option>
                        {[...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort().map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>NEW NAME</label>
                      <input
                        type="text"
                        value={hospitalRenameTo}
                        onChange={e => { setHospitalRenameTo(e.target.value); setHospitalRenameResult(null); }}
                        placeholder="Enter new hospital name..."
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.ink, fontFamily: "'IBM Plex Sans', sans-serif" }}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {hospitalRenameFrom && hospitalRenameTo && hospitalRenameFrom !== hospitalRenameTo && (
                    <div style={{ background: C.amberLight, border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.amber }}>
                      ⚠️ This will rename <strong>"{hospitalRenameFrom}"</strong> to <strong>"{hospitalRenameTo}"</strong> across{" "}
                      <strong>{allEntriesFull.filter(e => e.hospital === hospitalRenameFrom).length} sessions</strong>. This cannot be undone.
                    </div>
                  )}

                  {/* Result */}
                  {hospitalRenameResult && (
                    <div style={{ background: hospitalRenameResult.error ? C.redLight : C.greenLight, border: `1px solid ${hospitalRenameResult.error ? C.red : C.green}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: hospitalRenameResult.error ? C.red : C.green }}>
                      {hospitalRenameResult.error
                        ? `Error: ${hospitalRenameResult.error}`
                        : `✓ Successfully renamed ${hospitalRenameResult.count} session${hospitalRenameResult.count !== 1 ? "s" : ""}.`}
                    </div>
                  )}

                  <button
                    disabled={!hospitalRenameFrom || !hospitalRenameTo || hospitalRenameFrom === hospitalRenameTo || hospitalRenaming}
                    onClick={async () => {
                      if (!window.confirm(`Rename "${hospitalRenameFrom}" to "${hospitalRenameTo}" across all sessions?`)) return;
                      setHospitalRenaming(true);
                      setHospitalRenameResult(null);

                      // Update sessions
                      const { data, error } = await supabase
                        .from("sessions")
                        .update({ hospital: hospitalRenameTo })
                        .eq("hospital", hospitalRenameFrom)
                        .select();

                      if (error) {
                        setHospitalRenaming(false);
                        setHospitalRenameResult({ error: error.message });
                        return;
                      }

                      // Update hospital_branding
                      await supabase.from("hospital_branding")
                        .update({ hospital: hospitalRenameTo })
                        .eq("hospital", hospitalRenameFrom);

                      // Update bed_layouts
                      await supabase.from("bed_layouts")
                        .update({ hospital: hospitalRenameTo })
                        .eq("hospital", hospitalRenameFrom);

                      setHospitalRenaming(false);
                      setHospitalRenameResult({ count: data.length });

                      // Update branding state
                      setHospitalBranding(prev => {
                        const updated = { ...prev };
                        if (updated[hospitalRenameFrom]) {
                          updated[hospitalRenameTo] = updated[hospitalRenameFrom];
                          delete updated[hospitalRenameFrom];
                        }
                        return updated;
                      });

                      // Refresh entries
                      setAllEntriesFull(prev => prev.map(e => e.hospital === hospitalRenameFrom ? { ...e, hospital: hospitalRenameTo } : e));
                      setEntries(prev => prev.map(e => e.hospital === hospitalRenameFrom ? { ...e, hospital: hospitalRenameTo } : e));
                      await logAudit("HOSPITAL_RENAMED", { from: hospitalRenameFrom, to: hospitalRenameTo, count: data.length });

                      // Clean up localStorage
                      const hospitalData = getHospitalData();
                      if (hospitalData[hospitalRenameFrom]) {
                        const oldData = hospitalData[hospitalRenameFrom];
                        if (!hospitalData[hospitalRenameTo]) {
                          hospitalData[hospitalRenameTo] = oldData;
                        } else {
                          const existing = hospitalData[hospitalRenameTo];
                          const mergedUnits = [...new Set([...(existing.units || []), ...(oldData.units || [])])];
                          const mergedProtocols = { ...(oldData.protocols || {}), ...(existing.protocols || {}) };
                          const mergedBedCounts = { ...(oldData.bedCounts || {}), ...(existing.bedCounts || {}) };
                          hospitalData[hospitalRenameTo] = { units: mergedUnits, protocols: mergedProtocols, bedCounts: mergedBedCounts };
                        }
                        delete hospitalData[hospitalRenameFrom];
                        saveHospitalData(hospitalData);
                      }
                      setHospitalRenameFrom("");
                      setHospitalRenameTo("");
                    }}
                    style={{ background: hospitalRenaming || !hospitalRenameFrom || !hospitalRenameTo || hospitalRenameFrom === hospitalRenameTo ? C.surfaceAlt : C.primary, color: hospitalRenaming || !hospitalRenameFrom || !hospitalRenameTo || hospitalRenameFrom === hospitalRenameTo ? C.inkLight : "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: hospitalRenaming || !hospitalRenameFrom || !hospitalRenameTo || hospitalRenameFrom === hospitalRenameTo ? "not-allowed" : "pointer", letterSpacing: "0.06em" }}>
                    {hospitalRenaming ? "RENAMING..." : "RENAME HOSPITAL"}
                  </button>
                </div>

                {/* Duplicate Hospital Detection */}
                {(() => {
                  const allHospitals = [...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort();
                  // Simple similarity: normalize names and find pairs with high overlap
                  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
                  const tokenize = (s: string) => new Set(normalize(s).split(" ").filter(w => w.length > 2));
                  const similarity = (a: string, b: string) => {
                    const ta = tokenize(a), tb = tokenize(b);
                    const intersection = [...ta].filter(w => tb.has(w)).length;
                    const union = new Set([...ta, ...tb]).size;
                    return union > 0 ? intersection / union : 0;
                  };
                  const pairs = [];
                  for (let i = 0; i < allHospitals.length; i++) {
                    for (let j = i + 1; j < allHospitals.length; j++) {
                      const score = similarity(allHospitals[i], allHospitals[j]);
                      const key = [allHospitals[i], allHospitals[j]].sort().join("|");
                      if (score >= 0.5 && !dismissedDuplicates.includes(key)) pairs.push({ a: allHospitals[i], b: allHospitals[j], score });
                    }
                  }
                  if (pairs.length === 0) return null;

                  const dismissPair = (a, b) => {
                    const key = [a, b].sort().join("|");
                    const updated = [...dismissedDuplicates, key];
                    setDismissedDuplicates(updated);
                    localStorage.setItem("caretrack_dismissed_dupes", JSON.stringify(updated));
                  };
                  return (
                    <div style={{ background: C.surface, border: `2px solid ${C.amber}44`, borderRadius: 12, padding: "24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber, letterSpacing: "0.1em" }}>POSSIBLE DUPLICATE HOSPITALS · {pairs.length}</div>
                      </div>
                      <p style={{ fontSize: 13, color: C.inkMid, marginBottom: 16, lineHeight: 1.6 }}>These hospital names look similar and may be duplicates. Use the Rename tool above to merge them.</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {pairs.map(({ a, b, score }) => (
                          <div key={`${a}|${b}`} style={{ background: C.amberLight, border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{a}</span>
                              <span style={{ fontSize: 11, color: C.inkLight }}>↔</span>
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{b}</span>
                              <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.amber, background: C.surface, borderRadius: 6, padding: "2px 8px" }}>
                                {Math.round(score * 100)}% match
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button onClick={() => { setHospitalRenameFrom(b); setHospitalRenameTo(a); setAdminSection("hospitals"); }}
                                style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                                MERGE → "{a}"
                              </button>
                              <button onClick={() => { setHospitalRenameFrom(a); setHospitalRenameTo(b); setAdminSection("hospitals"); }}
                                style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                                MERGE → "{b}"
                              </button>
                              <button onClick={() => dismissPair(a, b)}
                                style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", marginLeft: "auto" }}>
                                NOT A DUPLICATE ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* KAM Coverage Map */}
                {(() => {
                  const allHospitals = [...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort();
                  const kams = userProfiles.filter(p => p.role === "kam" && p.is_active !== false);
                  const coveredHospitals = new Set(kams.flatMap(k => k.accounts || []));
                  const covered = allHospitals.filter(h => coveredHospitals.has(h));
                  const uncovered = allHospitals.filter(h => !coveredHospitals.has(h));
                  const coveragePct = allHospitals.length ? Math.round((covered.length / allHospitals.length) * 100) : 0;

                  return (
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em" }}>KAM ACCOUNT COVERAGE</div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>✓ {covered.length} covered</span>
                          <span style={{ fontSize: 11, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>✕ {uncovered.length} uncovered</span>
                          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700, color: coveragePct >= 80 ? C.green : coveragePct >= 50 ? C.amber : C.red }}>{coveragePct}%</div>
                        </div>
                      </div>

                      {/* Coverage bar */}
                      <div style={{ height: 6, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden", marginBottom: 20 }}>
                        <div style={{ height: "100%", width: `${coveragePct}%`, background: coveragePct >= 80 ? C.green : coveragePct >= 50 ? C.amber : C.red, borderRadius: 3, transition: "width 0.6s ease" }} />
                      </div>

                      {kams.length === 0 ? (
                        <div style={{ fontSize: 12, color: C.inkLight, fontStyle: "italic" }}>No active KAMs assigned yet. Set a user's role to KAM in User Management to assign accounts.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {/* KAM list with their accounts */}
                          {kams.map(kam => (
                            <div key={kam.id} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.amberLight, border: `1px solid ${C.amber}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: C.amber, flexShrink: 0 }}>
                                  {(kam.full_name || kam.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{kam.full_name || kam.email}</div>
                                  <div style={{ fontSize: 10, color: C.inkLight }}>{(kam.accounts || []).length} account{(kam.accounts || []).length !== 1 ? "s" : ""} assigned</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {(kam.accounts || []).length === 0
                                  ? <span style={{ fontSize: 11, color: C.inkFaint, fontStyle: "italic" }}>No accounts assigned</span>
                                  : (kam.accounts || []).map(h => (
                                    <div key={h} style={{ background: C.amberLight, border: `1px solid ${C.amber}33`, borderRadius: 6, padding: "2px 10px", fontSize: 11, color: C.amber }}>{h}</div>
                                  ))
                                }
                              </div>
                            </div>
                          ))}

                          {/* Uncovered hospitals */}
                          {uncovered.length > 0 && (
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: C.red, letterSpacing: "0.1em", marginBottom: 8 }}>NO KAM ASSIGNED · {uncovered.length}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {uncovered.map(h => (
                                  <div key={h} style={{ background: C.redLight, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "2px 10px", fontSize: 11, color: C.red }}>{h}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Hospital list */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 16 }}>
                    ALL HOSPITALS ({[...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort().map(h => {
                      const count = allEntriesFull.filter(e => e.hospital === h).length;
                      const reps = [...new Set(allEntriesFull.filter(e => e.hospital === h).map(e => e.logged_by))].filter(Boolean);
                      const isTrial = !!(hospitalBranding[h]?.isTrial);
                      return (
                        <div key={h} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: isTrial ? C.amberLight : C.bg, borderRadius: 8, border: `1px solid ${isTrial ? C.amber + "44" : "transparent"}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{h}</div>
                              {isTrial && <span style={{ background: C.amber, color: "white", borderRadius: 6, padding: "1px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, letterSpacing: "0.06em" }}>TRIAL</span>}
                              {hospitalBranding[h]?.salesforceAccountId && <span style={{ background: "#1a6bb5", color: "white", borderRadius: 6, padding: "1px 8px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, letterSpacing: "0.06em" }}>SFDC</span>}
                            </div>
                            <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>{reps.join(", ")}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.primary, fontWeight: 600 }}>{count}</div>
                              <div style={{ fontSize: 10, color: C.inkLight }}>sessions</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>TRIAL</span>
                              <div onClick={async () => {
                                const newTrial = !isTrial;
                                const updated = { ...hospitalBranding, [h]: { ...(hospitalBranding[h] || {}), isTrial: newTrial } };
                                setHospitalBranding(updated);
                                await supabase.from("hospital_branding").upsert([{ hospital: h, is_trial: newTrial }], { onConflict: "hospital" });
                                logAudit(isTrial ? "HOSPITAL_TRIAL_REMOVED" : "HOSPITAL_TRIAL_SET", { hospital: h });
                              }}
                                style={{ width: 36, height: 20, borderRadius: 10, background: isTrial ? C.amber : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                <div style={{ position: "absolute", top: 3, left: isTrial ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                              </div>
                            </div>
                            {hospitalBranding[h]?.salesforceAccountId && (
                              (() => {
                                const synced = allEntriesFull.filter(e => e.hospital === h && e.sf_synced_at).length;
                                const unsynced = allEntriesFull.filter(e => e.hospital === h && !e.sf_synced_at).length;
                                const isSyncing = sfSyncing[h]?.status === "syncing";
                                const isDone = sfSyncing[h]?.status === "done";
                                return (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                                    <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>
                                      <span style={{ color: C.green }}>{synced} synced</span>
                                      {unsynced > 0 && <span style={{ color: C.amber }}> · {unsynced} pending</span>}
                                    </div>
                                    <button
                                      disabled={isSyncing || unsynced === 0}
                                      onClick={async () => {
                                        const unsyncedSessions = allEntriesFull.filter(e => e.hospital === h && !e.sf_synced_at);
                                        setSfSyncing(prev => ({ ...prev, [h]: { status: "syncing", count: 0 } }));
                                        let syncedCount = 0;
                                        for (const session of unsyncedSessions) {
                                          try {
                                            const res = await supabase.functions.invoke("salesforce-sync", { body: { session } });
                                            if (!res.error) {
                                              syncedCount++;
                                              // Update local state to reflect sync
                                              setAllEntriesFull(prev => prev.map(e => e.id === session.id ? { ...e, sf_synced_at: new Date().toISOString() } : e));
                                              setSfSyncing(prev => ({ ...prev, [h]: { status: "syncing", count: syncedCount } }));
                                            }
                                          } catch (e) { console.warn("SF sync failed for session", session.id, e); }
                                        }
                                        setSfSyncing(prev => ({ ...prev, [h]: { status: "done", count: syncedCount } }));
                                        setTimeout(() => setSfSyncing(prev => { const n = { ...prev }; delete n[h]; return n; }), 4000);
                                      }}
                                      style={{ background: isDone ? C.greenLight : unsynced === 0 ? C.surfaceAlt : C.primaryLight, border: `1px solid ${isDone ? C.green : unsynced === 0 ? C.border : C.primary}33`, borderRadius: 6, padding: "4px 10px", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: isDone ? C.green : unsynced === 0 ? C.inkFaint : C.primary, cursor: isSyncing || unsynced === 0 ? "not-allowed" : "pointer", letterSpacing: "0.04em" }}>
                                      {isSyncing
                                        ? `↑ ${sfSyncing[h].count}/${unsynced}`
                                        : isDone
                                        ? `✓ ${sfSyncing[h].count} SYNCED`
                                        : unsynced === 0
                                        ? "✓ ALL SYNCED"
                                        : `↑ SYNC ${unsynced} TO SF`}
                                    </button>
                                  </div>
                                );
                              })()
                            )}
                            <button onClick={() => setConfiguringHospital(configuringHospital === h ? null : h)}
                              style={{ background: configuringHospital === h ? C.primary : "none", border: `1px solid ${configuringHospital === h ? C.primary : C.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: configuringHospital === h ? "white" : C.inkLight, cursor: "pointer", letterSpacing: "0.04em", flexShrink: 0 }}>
                              {configuringHospital === h ? "DONE" : "CONFIGURE"}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Inline Hospital Configuration Panel */}
                    {configuringHospital && (() => {
                      const hospital = configuringHospital;
                      const b = hospitalBranding[hospital] || {};
                      return (
                        <div style={{ background: C.surface, border: `2px solid ${C.primary}44`, borderRadius: 12, padding: 24, marginTop: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                            <div>
                              <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, letterSpacing: "0.1em", marginBottom: 2 }}>CONFIGURING</div>
                              <div style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{hospital}</div>
                            </div>
                            <button onClick={() => setConfiguringHospital(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.inkLight }}>✕</button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            {/* Left column */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                              {/* SF Account ID */}
                              <div>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>SALESFORCE ACCOUNT ID</label>
                                <input type="text" placeholder="001PW00000sZNnS" value={b.salesforceAccountId || ""}
                                  style={{ width: "100%", background: C.bg, border: `1px solid ${b.salesforceAccountId ? C.primary + "66" : C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: C.ink, outline: "none", fontFamily: "'IBM Plex Mono', monospace" }}
                                  onChange={ev => setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], salesforceAccountId: ev.target.value } }))} />
                                {b.salesforceAccountId && <div style={{ fontSize: 9, color: C.primary, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>✓ MAPPED TO SALESFORCE</div>}
                                {!b.salesforceAccountId && (
                                  <div style={{ marginTop: 6 }}>
                                    {!sfSuggestions[hospital] ? (
                                      <button onClick={async () => {
                                        const words = hospital.toLowerCase().split(' ').filter(w => w.length > 3);
                                        const { data: results } = await supabase.from('salesforce_accounts').select('id, name').ilike('name', `%${words[0] || hospital}%`).limit(8);
                                        setSfSuggestions(prev => ({ ...prev, [hospital]: results || [] }));
                                      }} style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.05em" }}>
                                        🔍 FIND IN SALESFORCE
                                      </button>
                                    ) : sfSuggestions[hospital].length === 0 ? (
                                      <div style={{ fontSize: 10, color: C.inkFaint }}>No matches — enter ID manually</div>
                                    ) : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                                        <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.06em" }}>SELECT MATCH:</div>
                                        {sfSuggestions[hospital].map((s: any) => (
                                          <button key={s.id} onClick={() => { setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], salesforceAccountId: s.id } })); setSfSuggestions(prev => ({ ...prev, [hospital]: [] })); }}
                                            style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "5px 10px", fontSize: 11, color: C.ink, cursor: "pointer", textAlign: "left" }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary }}>{s.id}</span> — {s.name}
                                          </button>
                                        ))}
                                        <button onClick={() => setSfSuggestions(prev => ({ ...prev, [hospital]: undefined }))} style={{ fontSize: 9, color: C.inkFaint, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>✕ clear</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Logo URL */}
                              <div>
                                <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>LOGO URL</label>
                                <input type="text" placeholder="https://example.com/logo.png" value={b.logoUrl || ""}
                                  style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: C.ink, outline: "none" }}
                                  onChange={ev => setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], logoUrl: ev.target.value } }))} />
                                {b.logoUrl && <img src={b.logoUrl} alt={hospital} style={{ height: 28, maxWidth: 120, objectFit: "contain", borderRadius: 4, border: `1px solid ${C.border}`, padding: 4, background: "white", marginTop: 6 }} onError={e => e.target.style.display = "none"} />}
                              </div>

                              {/* Shared Account */}
                              <div>
                                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>SHARED ACCOUNT</div>
                                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                                  <div onClick={() => setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], isShared: !b.isShared } }))}
                                    style={{ width: 36, height: 20, borderRadius: 10, background: b.isShared ? C.primary : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                    <div style={{ position: "absolute", top: 3, left: b.isShared ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                                  </div>
                                  <span style={{ fontSize: 12, color: C.ink }}>{b.isShared ? "Shared — all reps see each other's sessions" : "Not shared"}</span>
                                </label>
                              </div>

                              {/* Dashboard Metrics */}
                              <div>
                                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>DASHBOARD METRICS</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  {getMetrics(hospital).map(m => {
                                    const enabled = b.enabledMetrics ? b.enabledMetrics.includes(m.id) : true;
                                    return (
                                      <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                        <input type="checkbox" checked={enabled} onChange={() => {
                                          const allIds = getMetrics(hospital).map(x => x.id);
                                          const current = b.enabledMetrics || allIds;
                                          const next = current.includes(m.id) ? current.filter(x => x !== m.id) : [...current, m.id];
                                          setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], enabledMetrics: next.length === allIds.length ? null : next } }));
                                        }} style={{ accentColor: C.primary, width: 13, height: 13, cursor: "pointer" }} />
                                        <span style={{ fontSize: 12, color: enabled ? C.ink : C.inkFaint }}>{m.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Copy to another hospital */}
                              <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>COPY TO ANOTHER HOSPITAL</div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <select value={copyBrandingTo || ""} onChange={ev => setCopyBrandingTo(ev.target.value || null)}
                                    style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: C.ink, outline: "none" }}>
                                    <option value="">Select hospital...</option>
                                    {[...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort().filter(hh => hh !== hospital).map(hh => <option key={hh} value={hh}>{hh}</option>)}
                                  </select>
                                  <button onClick={() => { if (!copyBrandingTo) return; setHospitalBranding(prev => ({ ...prev, [copyBrandingTo]: { ...b, isTrial: prev[copyBrandingTo]?.isTrial || false } })); setCopyBrandingTo(null); alert(`Copied to ${copyBrandingTo}. Save to persist.`); }}
                                    disabled={!copyBrandingTo}
                                    style={{ background: copyBrandingTo ? C.primary : C.surfaceAlt, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: copyBrandingTo ? "white" : C.inkFaint, cursor: copyBrandingTo ? "pointer" : "not-allowed", letterSpacing: "0.05em", flexShrink: 0 }}>
                                    COPY
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Right column — colors */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {[
                                ["PRIMARY COLOR", "accentColor", "#4a6f7a"],
                                ["SECONDARY COLOR", "secondaryColor", "#7C5366"],
                                ["TERTIARY COLOR", "tertiaryColor", "#3a7d5c"],
                                ["TEXT COLOR", "textColor", "#2a2624"],
                                ["COVER COLOR", "coverColor", "#4F6E77"],
                              ].map(([label, key, def]) => (
                                <div key={key}>
                                  <label style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>{label}</label>
                                  <input type="color" value={b[key] || def}
                                    style={{ width: 44, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, cursor: "pointer", padding: 2 }}
                                    onChange={ev => setHospitalBranding(prev => ({ ...prev, [hospital]: { ...prev[hospital], [key]: ev.target.value } }))} />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                            <button onClick={() => setConfiguringHospital(null)}
                              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 18px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>
                              CANCEL
                            </button>
                            <button onClick={async () => {
                              const row = {
                                hospital,
                                logo_url: b.logoUrl || null,
                                accent_color: b.accentColor || null,
                                secondary_color: b.secondaryColor || null,
                                tertiary_color: b.tertiaryColor || null,
                                text_color: b.textColor || null,
                                cover_color: b.coverColor || null,
                                is_trial: b.isTrial || false,
                                enabled_metrics: b.enabledMetrics || null,
                                is_shared: b.isShared || false,
                                salesforce_account_id: b.salesforceAccountId || null,
                              };
                              const { error } = await supabase.from("hospital_branding").upsert([row], { onConflict: "hospital" });
                              if (error) { alert("Save failed: " + error.message); return; }
                              setConfiguringHospital(null);
                            }}
                              style={{ background: C.primary, border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.06em" }}>
                              SAVE CONFIGURATION
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ── AUDIT LOG SECTION ── */}
            {/* ── AUTO REPORTS SECTION ── */}
            {adminSection === "auto_reports" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Header + new button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>AUTO REPORTS</div>
                    <p style={{ fontSize: 13, color: C.inkMid, margin: 0 }}>Schedule compliance PDFs to be emailed automatically to external recipients.</p>
                  </div>
                  <button onClick={() => { setScheduleForm({ name: "", hospitals: [], recipients: "", frequency: "monthly", dayOfMonth: "1", dayOfWeek: "1", period: "30d" }); setEditingScheduleId(null); setShowNewSchedule(true); }}
                    style={{ background: C.primary, border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em", flexShrink: 0 }}>
                    + NEW REPORT
                  </button>
                </div>

                {/* New/Edit schedule form */}
                {showNewSchedule && (
                  <div style={{ background: C.surface, border: `2px solid ${C.primary}33`, borderRadius: 12, padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.primary, letterSpacing: "0.1em" }}>{editingScheduleId ? "EDIT SCHEDULED REPORT" : "NEW SCHEDULED REPORT"}</div>
                      <button onClick={() => { setShowNewSchedule(false); setEditingScheduleId(null); }} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: C.inkLight }}>✕</button>
                    </div>

                    {/* Name */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>REPORT NAME</label>
                      <input value={scheduleForm.name} onChange={e => setScheduleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly ICU Compliance — St. Mary's"
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif", boxSizing: "border-box" }} />
                    </div>

                    {/* Hospital multi-select */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>HOSPITALS ({scheduleForm.hospitals.length} selected)</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {scheduleForm.hospitals.map(h => (
                          <div key={h} style={{ display: "flex", alignItems: "center", gap: 4, background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 6, padding: "3px 10px" }}>
                            <span style={{ fontSize: 11, color: C.primary }}>{h}</span>
                            <button onClick={() => setScheduleForm(f => ({ ...f, hospitals: f.hospitals.filter(x => x !== h) }))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                      <select value="" onChange={e => { const h = e.target.value; if (h && !scheduleForm.hospitals.includes(h)) setScheduleForm(f => ({ ...f, hospitals: [...f.hospitals, h] })); }}
                        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.inkMid, outline: "none", cursor: "pointer", width: "100%" }}>
                        <option value="">+ Add hospital...</option>
                        {[...new Set(allEntriesFull.map(e => e.hospital).filter(Boolean))].sort()
                          .filter(h => !scheduleForm.hospitals.includes(h))
                          .map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    {/* Recipients */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>RECIPIENT EMAILS (comma-separated)</label>
                      <input value={scheduleForm.recipients} onChange={e => setScheduleForm(f => ({ ...f, recipients: e.target.value }))} placeholder="nurse@hospital.com, director@hospital.com"
                        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.ink, outline: "none", fontFamily: "'IBM Plex Sans', sans-serif", boxSizing: "border-box" }} />
                    </div>

                    {/* Frequency + Period row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>FREQUENCY</label>
                        <select value={scheduleForm.frequency} onChange={e => setScheduleForm(f => ({ ...f, frequency: e.target.value }))}
                          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.ink, outline: "none" }}>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      {scheduleForm.frequency === "weekly" && (
                        <div>
                          <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>DAY OF WEEK</label>
                          <select value={scheduleForm.dayOfWeek} onChange={e => setScheduleForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.ink, outline: "none" }}>
                            {["Monday","Tuesday","Wednesday","Thursday","Friday"].map((d, i) => <option key={d} value={String(i+1)}>{d}</option>)}
                          </select>
                        </div>
                      )}
                      {scheduleForm.frequency === "monthly" && (
                        <div>
                          <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>DAY OF MONTH</label>
                          <select value={scheduleForm.dayOfMonth} onChange={e => setScheduleForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.ink, outline: "none" }}>
                            {[1,2,3,4,5,6,7,8,10,14,15,20,25,28].map(d => <option key={d} value={String(d)}>{d}{d===1?"st":d===2?"nd":d===3?"rd":"th"}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>REPORT PERIOD</label>
                        <select value={scheduleForm.period} onChange={e => setScheduleForm(f => ({ ...f, period: e.target.value }))}
                          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.ink, outline: "none" }}>
                          <option value="7d">Last 7 days</option>
                          <option value="30d">Last 30 days</option>
                          <option value="mtd">Month to date</option>
                          <option value="all">All time</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowNewSchedule(false)}
                        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 18px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>
                        CANCEL
                      </button>
                      <button disabled={scheduleSaving || !scheduleForm.name || scheduleForm.hospitals.length === 0 || !scheduleForm.recipients} onClick={async () => {
                        setScheduleSaving(true);
                        const payload = {
                          name: scheduleForm.name,
                          hospitals: scheduleForm.hospitals,
                          recipients: scheduleForm.recipients.split(",").map(e => e.trim()).filter(Boolean),
                          frequency: scheduleForm.frequency,
                          day_of_month: scheduleForm.frequency === "monthly" ? parseInt(scheduleForm.dayOfMonth) : null,
                          day_of_week: scheduleForm.frequency === "weekly" ? parseInt(scheduleForm.dayOfWeek) : null,
                          period: scheduleForm.period,
                        };
                        if (editingScheduleId) {
                          const { data, error } = await supabase.from("report_schedules").update(payload).eq("id", editingScheduleId).select().single();
                          setScheduleSaving(false);
                          if (!error && data) {
                            setReportSchedules(prev => prev.map(s => s.id === editingScheduleId ? data : s));
                            setShowNewSchedule(false);
                            setEditingScheduleId(null);
                            await logAudit("REPORT_SCHEDULE_UPDATED", { name: scheduleForm.name });
                          } else {
                            alert("Failed to update: " + (error?.message || "Unknown error"));
                          }
                        } else {
                          const { data, error } = await supabase.from("report_schedules").insert([{ ...payload, is_active: true, created_by: user?.email }]).select().single();
                          setScheduleSaving(false);
                          if (!error && data) {
                            setReportSchedules(prev => [data, ...prev]);
                            setShowNewSchedule(false);
                            await logAudit("REPORT_SCHEDULE_CREATED", { name: scheduleForm.name, hospitals: scheduleForm.hospitals });
                          } else {
                            alert("Failed to save: " + (error?.message || "Unknown error"));
                          }
                        }
                      }}
                        style={{ background: scheduleSaving ? C.border : C.primary, border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: scheduleSaving ? "not-allowed" : "pointer", letterSpacing: "0.05em" }}>
                        {scheduleSaving ? "SAVING..." : editingScheduleId ? "UPDATE SCHEDULE" : "SAVE SCHEDULE"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Schedule list */}
                {reportSchedules.length === 0 && !showNewSchedule && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 8 }}>No scheduled reports yet</div>
                    <div style={{ fontSize: 13, color: C.inkMid }}>Create a schedule to automatically send compliance PDFs to external recipients.</div>
                  </div>
                )}

                {reportSchedules.map(sched => {
                  const freqLabel = sched.frequency === "weekly"
                    ? `Weekly · ${["","Mon","Tue","Wed","Thu","Fri"][sched.day_of_week] || ""}`
                    : `Monthly · ${sched.day_of_month}${sched.day_of_month===1?"st":sched.day_of_month===2?"nd":sched.day_of_month===3?"rd":"th"}`;
                  const periodLabel = { "7d":"Last 7 days","30d":"Last 30 days","mtd":"Month to date","all":"All time" }[sched.period] || sched.period;
                  const lastSent = sched.last_sent ? new Date(sched.last_sent).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "Never sent";

                  return (
                    <div key={sched.id} style={{ background: C.surface, border: `1px solid ${sched.is_active ? C.border : C.border}`, borderRadius: 12, padding: "20px 24px", opacity: sched.is_active ? 1 : 0.6 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{sched.name}</div>
                            {!sched.is_active && <span style={{ fontSize: 9, background: C.surfaceAlt, color: C.inkLight, borderRadius: 6, padding: "1px 8px", fontFamily: "'IBM Plex Mono', monospace" }}>PAUSED</span>}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {(sched.hospitals || []).map(h => (
                              <span key={h} style={{ background: C.primaryLight, color: C.primary, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: C.inkLight, display: "flex", flexWrap: "wrap", gap: 16 }}>
                            <span>📅 {freqLabel}</span>
                            <span>📊 {periodLabel}</span>
                            <span>📨 {(sched.recipients || []).join(", ")}</span>
                            <span style={{ color: sched.last_sent ? C.green : C.inkFaint }}>✉ Last sent: {lastSent}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          {/* Edit */}
                          <button onClick={() => {
                            setScheduleForm({
                              name: sched.name,
                              hospitals: sched.hospitals || [],
                              recipients: (sched.recipients || []).join(", "),
                              frequency: sched.frequency || "monthly",
                              dayOfMonth: sched.day_of_month?.toString() || "1",
                              dayOfWeek: sched.day_of_week?.toString() || "1",
                              period: sched.period || "30d",
                            });
                            setEditingScheduleId(sched.id);
                            setShowNewSchedule(true);
                          }}
                            style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>
                            EDIT
                          </button>
                          {/* Send now */}
                          <button disabled={scheduleSending === sched.id} onClick={async () => {
                            setScheduleSending(sched.id);
                            try {
                              const res = await supabase.functions.invoke("send-scheduled-reports", { body: { scheduleId: sched.id, preview: false } });
                              if (res.error) throw new Error(res.error.message);
                              alert(`Report sent to ${(sched.recipients || []).join(", ")}`);
                              const { data: updated } = await supabase.from("report_schedules").select("*").order("created_at", { ascending: false });
                              setReportSchedules(updated || []);
                            } catch (err) {
                              alert("Send failed: " + err.message);
                            } finally {
                              setScheduleSending(null);
                            }
                          }}
                            style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 8, padding: "6px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, cursor: scheduleSending === sched.id ? "not-allowed" : "pointer" }}>
                            {scheduleSending === sched.id ? "SENDING..." : "SEND NOW"}
                          </button>
                          {/* Pause/resume */}
                          <button onClick={async () => {
                            const { error } = await supabase.from("report_schedules").update({ is_active: !sched.is_active }).eq("id", sched.id);
                            if (!error) setReportSchedules(prev => prev.map(s => s.id === sched.id ? { ...s, is_active: !s.is_active } : s));
                          }}
                            style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>
                            {sched.is_active ? "PAUSE" : "RESUME"}
                          </button>
                          {/* Delete */}
                          <button onClick={async () => {
                            if (!window.confirm(`Delete schedule "${sched.name}"?`)) return;
                            await supabase.from("report_schedules").delete().eq("id", sched.id);
                            setReportSchedules(prev => prev.filter(s => s.id !== sched.id));
                            await logAudit("REPORT_SCHEDULE_DELETED", { name: sched.name });
                          }}
                            style={{ background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "6px 14px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.red, cursor: "pointer" }}>
                            DELETE
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
                        DELETION_REQUESTED: C.amber, DELETION_APPROVED: C.red, DELETION_DENIED: C.green,
                      };
                      const actionLabels = {
                        SESSION_CREATED: "Session Created", SESSION_EDITED: "Session Edited",
                        SESSION_DELETED: "Session Deleted", USER_DEACTIVATED: "User Deactivated",
                        USER_REACTIVATED: "User Reactivated", PASSWORD_RESET_SENT: "Password Reset Sent",
                        ALL_SESSIONS_DELETED: "All Sessions Deleted",
                        DELETION_REQUESTED: "Deletion Requested", DELETION_APPROVED: "Deletion Approved", DELETION_DENIED: "Deletion Denied",
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

      {/* ── PWA INSTALL BANNER ────────────────────────────────────────────── */}
      {showInstallBanner && !installDismissed && !isInStandaloneMode() && (
        <div style={{ position: "fixed", bottom: 72, left: 12, right: 12, zIndex: 900, maxWidth: 480, margin: "0 auto" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.primary}44`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>📲</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 3 }}>Add CareTrack to Home Screen</div>
              {isIOS()
                ? <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>
                    Tap <strong style={{ color: C.primary }}>Share</strong> then <strong style={{ color: C.primary }}>"Add to Home Screen"</strong> for instant one-tap access.
                  </div>
                : <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>
                    Install CareTrack for instant one-tap access — no app store needed.
                  </div>
              }
              {!isIOS() && pwaPrompt && (
                <button onClick={async () => {
                  pwaPrompt.prompt();
                  const { outcome } = await pwaPrompt.userChoice;
                  if (outcome === "accepted") {
                    setShowInstallBanner(false);
                    setInstallDismissed(true);
                    localStorage.setItem("caretrack_install_dismissed", "1");
                  }
                  setPwaPrompt(null);
                }} style={{ marginTop: 10, background: C.primary, border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.06em" }}>
                  INSTALL APP
                </button>
              )}
            </div>
            <button onClick={() => {
              setShowInstallBanner(false);
              setInstallDismissed(true);
              localStorage.setItem("caretrack_install_dismissed", "1");
            }} style={{ background: "none", border: "none", color: C.inkLight, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}

      {/* ── ONBOARDING MODAL ───────────────────────────────────────────────── */}
      {showOnboarding && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: C.surface, borderRadius: "20px 20px 0 0", maxWidth: 480, width: "100%", padding: "28px 24px 36px", boxShadow: "0 -8px 40px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>

            {/* Step dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: i === onboardingStep ? 20 : 6, height: 6, borderRadius: 3, background: i === onboardingStep ? C.primary : C.border, transition: "all 0.2s" }} />
              ))}
            </div>

            {/* ── STEP 0: WELCOME ── */}
            {onboardingStep === 0 && (
              <>
                <div style={{ fontSize: 40, marginBottom: 14, textAlign: "center" }}>👋</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, marginBottom: 10, textAlign: "center" }}>Welcome to CareTrack</h2>
                <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>Your tool for tracking wound care compliance across hospitals. Log an audit after every visit — your dashboard builds itself from there.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                  {[
                    ["📋", "Log Audit",  "Record compliance data after each visit"],
                    ["📊", "Dashboard",  "Trends, averages, and export tools"],
                    ["📁", "History",    "Browse and edit past sessions"],
                    ["🏆", "Performers", "Hospital and unit rankings"],
                  ].map(([icon, title, desc]) => (
                    <div key={title} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: C.bg, borderRadius: 10 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</div>
                        <div style={{ fontSize: 12, color: C.inkLight, marginTop: 1 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setOnboardingStep(1)} style={{ width: "100%", background: C.primary, border: "none", borderRadius: 10, padding: "16px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.08em" }}>
                  SHOW ME HOW →
                </button>
              </>
            )}

            {/* ── STEP 1: HOW TO LOG ── */}
            {onboardingStep === 1 && (
              <>
                <div style={{ fontSize: 40, marginBottom: 14, textAlign: "center" }}>📋</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, marginBottom: 8, textAlign: "center" }}>Logging an audit</h2>
                <p style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>Fill in these four things after every hospital visit.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                  {[
                    ["1", "Date",     "Today's date is filled in automatically — change it if logging retroactively."],
                    ["2", "Hospital", "Type or select the hospital name. CareTrack remembers hospitals you've used before."],
                    ["3", "Unit",     "Enter the unit or location. Previously used units appear as a quick-pick list."],
                    ["4", "Metrics",  "Use Per Bed mode to tap YES/NO for each metric per bed. Totals calculate automatically."],
                  ].map(([num, title, desc]) => (
                    <div key={num} style={{ display: "flex", gap: 14, padding: "14px", background: C.bg, borderRadius: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{num}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 3 }}>{title}</div>
                        <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setOnboardingStep(0)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>← BACK</button>
                  <button onClick={() => setOnboardingStep(2)} style={{ flex: 2, background: C.primary, border: "none", borderRadius: 10, padding: "14px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.05em" }}>TRY IT NOW →</button>
                </div>
              </>
            )}

            {/* ── STEP 2: PRACTICE SESSION — BED GRID ── */}
            {onboardingStep === 2 && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.primary, letterSpacing: "0.1em", marginBottom: 4 }}>PRACTICE SESSION</div>
                  <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 400, marginBottom: 6 }}>Log your first audit</h2>
                  <p style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.5 }}>Tap YES or NO for each metric on each bed. We'll delete this practice entry automatically when you're done.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 3 }}>DATE</div>
                    <div style={{ fontSize: 13, color: C.ink }}>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 3 }}>UNIT</div>
                    <div style={{ fontSize: 13, color: C.ink }}>Practice Unit</div>
                  </div>
                  <div style={{ gridColumn: "span 2", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 3 }}>HOSPITAL</div>
                    <div style={{ fontSize: 13, color: C.ink }}>Practice Hospital</div>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <BedGrid
                    metrics={METRICS}
                    beds={practiceBedGrid}
                    onChange={setPracticeBedGrid}
                    onAddBed={() => {
                      const n = practiceBedGrid.length + 1;
                      const b = createEmptyBed(METRICS, n);
                      b.room = String(n);
                      setPracticeBedGrid(prev => [...prev, b]);
                    }}
                    onRemoveBed={(idx) => setPracticeBedGrid(prev => prev.filter((_, i) => i !== idx))}
                  />
                </div>
                {practiceError && (
                  <div style={{ background: C.redLight, border: `1px solid ${C.red}33`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 12 }}>{practiceError}</div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setOnboardingStep(1)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>← BACK</button>
                  <button disabled={practiceSaving} onClick={async () => {
                    const metricTotals = {};
                    METRICS.forEach(m => {
                      const active = practiceBedGrid.filter(b => !b.na && !b[`${m.id}_na`]);
                      metricTotals[`${m.id}_den`] = active.reduce((s, b) => s + (parseInt(b[`${m.id}_q`]) || 0), 0) || null;
                      metricTotals[`${m.id}_num`] = active.reduce((s, b) => s + (parseInt(b[`${m.id}_a`]) || 0), 0) || null;
                    });
                    setPracticeError(null); setPracticeSaving(true);
                    const { data, error } = await supabase.from("sessions").insert([{
                      date: new Date().toISOString().slice(0, 10),
                      hospital: "Practice Hospital", location: "Practice Unit",
                      notes: "Onboarding practice session — will be deleted automatically.",
                      logged_by: userName, bed_data: practiceBedGrid, ...metricTotals,
                    }]).select().single();
                    setPracticeSaving(false);
                    if (error) { setPracticeError("Couldn't save. " + error.message); return; }
                    setPracticeSessionId(data.id);
                    setOnboardingStep(3);
                  }} style={{ flex: 2, background: C.primary, border: "none", borderRadius: 10, padding: "14px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: practiceSaving ? "not-allowed" : "pointer", letterSpacing: "0.05em", opacity: practiceSaving ? 0.7 : 1 }}>
                    {practiceSaving ? "SAVING…" : "SAVE AUDIT →"}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3: SUCCESS ── */}
            {onboardingStep === 3 && (
              <>
                <div style={{ fontSize: 40, marginBottom: 14, textAlign: "center" }}>🎉</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400, marginBottom: 10, textAlign: "center" }}>You've got it!</h2>
                <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, marginBottom: 8, textAlign: "center" }}>Your practice audit was saved. Tap below to start logging real sessions — we'll delete the practice entry in the background.</p>
                <p style={{ fontSize: 12, color: C.inkLight, lineHeight: 1.6, marginBottom: 28, textAlign: "center" }}>You can revisit this guide anytime from the <strong>What's New</strong> button.</p>
                <button onClick={async () => {
                  setShowOnboarding(false);
                  localStorage.setItem("caretrack_onboarded", "true");
                  setShowChecklist(true);
                  setTab("log");
                  if (practiceSessionId) {
                    await supabase.from("sessions").delete().eq("id", practiceSessionId);
                    setEntries(prev => prev.filter(e => e.id !== practiceSessionId));
                  }
                }} style={{ width: "100%", background: C.primary, border: "none", borderRadius: 10, padding: "16px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.08em" }}>
                  START LOGGING →
                </button>
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
              { version: "3.3", date: "April 2026", badge: "LATEST", items: [
                "Salesforce integration — compliance sessions automatically sync to the matching Salesforce Account record when logged; deletions in CareTrack also remove the Salesforce record [Admin]",
                "Salesforce Account ID mapping — admins can map any hospital to its Salesforce Account ID directly in Hospital Configuration, with a built-in search across all 8,000+ HoverTech accounts [Admin]",
                "Shared hospital accounts — admins can mark a hospital as a shared account; reps who have logged there see each other's sessions across Dashboard, History, and Performers [Admin]",
                "Shared account notifications — when any rep logs a session at a shared hospital, all reps who share that account receive an email notification with the session details and metrics",
                "Per-hospital dashboard metric visibility — admins can control which metrics appear on the dashboard for each hospital; applies to PDF exports as well [Admin]",
                "Bed layout editor — admins can define the bed count and room labels for any hospital unit; reps see the layout pre-populated with a 'LAYOUT LOADED' badge when they select that unit [Admin]",
                "Delete Bed — a new Delete Bed button appears in the per-bed grid during session entry, with a confirmation dialog showing the bed number and room label",
                "Auto report PDF attachments — Send Now generates and attaches the full branded PDF report to the email; scheduled cron sends generate a PDF via PDFShift automatically",
                "Auto report editing — existing scheduled reports can now be edited directly from the Auto Reports panel [Admin]",
                "All Regions view — admins now have access to the All Regions tab, showing rep activity and compliance across the entire organisation [Admin]",
                "SFDC badge — hospitals mapped to a Salesforce account show a blue SFDC badge in the Admin Hospitals list [Admin]",
                "Login tracking fix — Last Login now accurately reflects the most recent sign-in for all users [Admin]",
                "Delete All Sessions removed — the bulk delete button has been removed from the Admin panel for safety [Admin]",
              ]},
              { version: "3.2", date: "April 2026", badge: null, items: [
                "Hospital branding: Primary Text Color — controls heading and title text color in PDF exports",
                "Hospital branding: Cover Color — sets the title page background independently from the header color on other pages",
              ]},
              { version: "3.1", date: "April 2026", badge: "LATEST", items: [
                "Hospital branding now applies correctly to PDF exports — primary color, secondary color, and logo all render",
                "Secondary color added to hospital branding — controls accent bar on PDF header and title page",
                "Hospital logo now embeds in PDF title page when a logo URL is configured",
              ]},
              { version: "3.0", date: "April 2026", badge: "LATEST", items: [
                "Hospital branding (logos, colors, trial flags) now stored in Supabase — changes apply instantly across all devices",
                "Per Bed mode is now the default — switch to Simple mode if needed",
                "Duplicate detection now also catches sessions logged within the last 4 hours for the same unit",
                "Per Bed mode now requires at least one YES/NO tap before saving — prevents accidental empty sessions",
                "Bed count shows a SAVED badge when it auto-populates from a previous visit",
              ]},
              { version: "2.9", date: "April 2026", badge: "LATEST", items: [
                "Session confirmation email — automatically receive a summary of every session you log, including all metric results and notes",
                "Weekly summary email — every Monday morning you'll receive your prior week's stats: sessions logged, hospitals visited, and avg compliance vs the week before",
                "Forgot password — new link on the login screen lets you reset your password by email without contacting an admin",
                "Password reset — clicking a reset link now takes you to a proper set-new-password screen instead of logging you straight in",
                "Photo thumbnails — session photos now show inline on History cards; tap any thumbnail to view full size",
                "Last session card — Dashboard now opens with a summary of your most recent session at the top",
                "MoM in exports — Month-over-month comparison now included as a dedicated page in PDF and PowerPoint exports",
                "Rep filter — Directors and VPs can now filter all tabs (Dashboard, History, Performers, Planner) to a single rep via a dropdown",
                "Account request flow — new users now select their role and region when signing up; admins approve or reject from User Management",
              ]},
              { version: "2.8", date: "March 2026", badge: null, items: [
                "Onboarding redesign — new mobile bottom-sheet walkthrough with a live bed grid practice session that auto-deletes on completion",
                "PDF session log — metrics now shown in grouped category columns (Matt Compliance, Wedge Compliance, Turning, Air Supply) with colour-coded values",
                "PDF bed detail page — per-bed compliance breakdown added after the session log when Per Bed data is present",
                "PDF AI summary — markdown formatting stripped, 1,200-character limit removed, overflow pages added for long summaries",
                "Mayo and Kaiser metrics — air_reposition, heel_boots, and turn_clock now included dynamically in PDF and PowerPoint exports when present",
                "Admin: Hospital rename tool — bulk-rename a hospital across all sessions from a new Hospitals tab, with audit logging",
                "Security: RLS policies tightened — users can only read and write their own sessions; audit log restricted to admins only",
              ]},
              { version: "2.7", date: "March 2026", badge: null, items: [
                "Log Audit — form renamed from \"Log Session\" throughout the app",
                "Kaiser Permanente metrics — opt-in Heel Boots On and Turn Clock compliance metrics for Kaiser hospitals",
                "Deletion requests — reps can request a session be deleted; admins approve or deny from a new Admin tab panel",
                "Per Bed card mode — enter compliance data bed-by-bed with room labels, per-metric N/A toggles, and live totals",
                "Per Bed data saved to database and included in PDF, PowerPoint, and Excel exports as a detailed breakdown",
                "Kaiser metrics (Heel Boots, Turn Clock) flow through to all exports when present",
                "Date range filter on dashboard — scope all metrics, charts, and exports to a custom date window",
              ]},
              { version: "2.6", date: "March 2026", badge: null, items: [
                "In-app User Guide — downloadable PDF walkthrough accessible from the header",
                "Session print layout improvements — fixed blank page on print",
              ]},
              { version: "2.5", date: "March 2026", badge: null, items: [
                "Metric bucket grouping — metrics organized into Patient Met Criteria, Matt Compliance, Wedge Compliance, and Air Supply across dashboard, PDF, PowerPoint, and Excel exports",
                "Reordered metrics: Turning & Repositioning first, then Matt, Wedge, and Air Supply groups",
                "Bed-level grid input — enter compliance data per bed/room with auto-summed totals",
                "Toggle between Simple mode (aggregate entry) and Per Bed mode on the Log Audit form",
                "Number of beds saved per hospital/unit — auto-populates on return visits",
                "Mayo Clinic extra metric (Air Used to Reposition Patient)",
                "Fixed session save error for non-Mayo hospitals sending Mayo-only fields",
              ]},
              { version: "2.4", date: "March 2026", badge: null, items: [
                "Mobile layout overhaul — dashboard, performers, and admin sections fully optimised for phones",
                "Performers tab: hospital rows now use two-line cards so names and scores never get cut off",
                "Performers tab: Top Performers and Needs Attention stack vertically instead of side by side",
                "Admin dashboard: stats grid is now 2×2, sub-nav tabs scroll horizontally, user cards stack with full-width action buttons",
                "Dark mode now follows your device system setting automatically — no manual toggle needed on first use",
              ]},
              { version: "2.3", date: "March 2026", badge: null, items: [
                "Dark mode — toggle with the 🌙 button in the top-right corner",
                "Territory overview in Performers tab — all hospitals ranked with a single tap to drill in",
                "Duplicate session detection — warns before saving a session that already exists",
                "Customisable dashboard — hover any metric card and tap ✕ to hide it; restore from the bar below",
                "Session streak indicator — tracks consecutive weeks with logged sessions",
              ]},
              { version: "2.2", date: "March 2026", badge: null, items: [
                "Required field indicators (asterisks) on Date, Hospital, and Unit",
                "Session count badge on the History tab",
                "Manage Units — rename or delete saved units per hospital",
                "Print session summary — one-page printout from History tab",
                "Mobile optimisation — larger tap targets and responsive layout",
              ]},
              { version: "2.1", date: "March 2026", badge: null, items: [
                "Metric icons on dashboard cards — color-coded by compliance status",
                "Metric icons in PDF and PowerPoint exports",
                "Compliance cards sorted by status: On Target → Monitor → Needs Attention",
                "Log session form reordered: Date → Hospital → Unit → Protocol for Use",
                "Unit/location field now shows a saved picklist per hospital",
                "Protocol for Use auto-fills when a previously logged unit is selected",
                "N/A toggle on each metric — hides inputs and excludes from all calculations",
              ]},
              { version: "2.0", date: "February 2026", badge: null, items: [
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
                "Required field validation on Log Audit form",
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
            <button onClick={() => { setShowChangelog(false); setShowOnboarding(true); setOnboardingStep(0); setPracticeBedGrid([1,2,3,4].map(n => createEmptyBed(METRICS, n))); setPracticeSaving(false); setPracticeError(null); setPracticeSessionId(null); }} style={{ width: "100%", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer", marginTop: 8 }}>
              REPLAY ONBOARDING TOUR
            </button>
          </div>
        </div>
      )}

      {/* ── WHITE-LABEL BRANDING EDITOR (ADMIN ONLY) ───────────────────────── */}
      {/* ── UNIT MANAGER MODAL ──────────────────────────────────────────────── */}
      {showUnitManager && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowUnitManager(false)}>
          <div style={{ background: C.surface, borderRadius: 16, maxWidth: 480, width: "100%", padding: "36px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 400 }}>Manage Units</h2>
              <button onClick={() => setShowUnitManager(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.inkLight }}>✕</button>
            </div>
            <UnitManagerBody onClose={() => setShowUnitManager(false)} />
          </div>
        </div>
      )}

      {/* ── PRINT SESSION MODAL ─────────────────────────────────────────────── */}
      {printSession && (
        <div className="print-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setPrintSession(null)}>
          <div className="print-modal-content" style={{ background: "white", borderRadius: 16, maxWidth: 600, width: "100%", padding: "40px 44px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>CARETRACK · WOUND CARE COMPLIANCE</div>
                <h2 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 22, fontWeight: 700 }}>Session Summary</h2>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => window.print()} style={{ background: C.primary, border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "white", cursor: "pointer", letterSpacing: "0.06em" }}>PRINT</button>
                <button onClick={() => setPrintSession(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24, padding: "16px 20px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              {[["Date", printSession.date], ["Hospital", printSession.hospital], ["Unit", printSession.location], ["Logged By", printSession.logged_by]].map(([label, val]) => val ? (
                <div key={label}>
                  <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 2 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{val}</div>
                </div>
              ) : null)}
              {printSession.protocol_for_use && (
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 2 }}>PROTOCOL FOR USE</div>
                  <div style={{ fontSize: 13, color: C.inkMid, fontStyle: "italic" }}>{printSession.protocol_for_use}</div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 12 }}>COMPLIANCE METRICS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {getMetrics(printSession.hospital).map(m => {
                  const p = pct(printSession[`${m.id}_num`], printSession[`${m.id}_den`]);
                  const num = printSession[`${m.id}_num`];
                  const den = printSession[`${m.id}_den`];
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: p !== null ? pctBg(p) : C.surfaceAlt, borderRadius: 8, border: `1px solid ${p !== null ? pctColor(p) + "33" : C.border}` }}>
                      <div style={{ flex: 1, fontSize: 13, color: C.ink }}>{m.label}</div>
                      <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight }}>{num ?? "—"}/{den ?? "—"}</div>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, fontWeight: 700, color: p !== null ? pctColor(p) : C.inkFaint, minWidth: 48, textAlign: "right" }}>{p !== null ? `${p}%` : "N/A"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {printSession.notes && (
              <div style={{ padding: "14px 16px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>NOTES</div>
                <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{printSession.notes}</div>
              </div>
            )}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkFaint, textAlign: "center" }}>
              Printed from CareTrack · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* ── BOTTOM NAV (mobile only) ─────────────────────────────────────────── */}
      <div className="bottom-nav" style={{
        display: "none", // shown via CSS on mobile
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: C.surface, borderTop: `1px solid ${C.border}`,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        alignItems: "stretch",
      }}>
        {[
          { id: "log", label: "Log", icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          )},
          { id: "dashboard", label: "Dash", icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/>
            </svg>
          )},
          { id: "history", label: "History", badge: entries.length > 0 ? entries.length : null, icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          )},
          { id: "performers", label: "Rank", icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
          )},
          { id: "planner", label: "Plan", icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              <circle cx="8" cy="15" r="1" fill={active ? C.primary : C.inkLight}/><circle cx="12" cy="15" r="1" fill={active ? C.primary : C.inkLight}/><circle cx="16" cy="15" r="1" fill={active ? C.primary : C.inkLight}/>
            </svg>
          )},
          ...((isDirector || isVP) ? [{ id: "region", label: isVP ? "All" : "Region", icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          )}] : []),
          ...(isAdmin ? [{ id: "admin", label: "Admin", icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.primary : C.inkLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          )}] : []),
        ].map(({ id, label, icon, badge }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => { setTab(id); haptic("light"); }}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "8px 4px 6px", background: "none", border: "none", cursor: "pointer", position: "relative", gap: 3,
              }}>
              {active && <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 2, background: C.primary, borderRadius: "0 0 2px 2px" }} />}
              {badge != null && (
                <div style={{ position: "absolute", top: 6, left: "50%", marginLeft: 6, background: C.primary, color: "white", borderRadius: 8, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, padding: "0 4px", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {badge > 99 ? "99+" : badge}
                </div>
              )}
              {icon(active)}
              <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: active ? C.primary : C.inkLight, letterSpacing: "0.04em" }}>{label}</span>
            </button>
          );
        })}
        {/* ── Photo Lightbox ── */}
      {expandedPhotos && (
        <div onClick={() => setExpandedPhotos(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={expandedPhotos} alt="Full size"
              style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
            <button onClick={() => setExpandedPhotos(null)}
              style={{ position: "absolute", top: -16, right: -16, width: 32, height: 32, borderRadius: "50%", background: "white", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
              ✕
            </button>
            <a href={expandedPhotos} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.6)", textDecoration: "none", letterSpacing: "0.08em" }}>
              OPEN FULL SIZE ↗
            </a>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

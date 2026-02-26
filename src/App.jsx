import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#f7f5f0",
  surface: "#ffffff",
  surfaceAlt: "#f0ede6",
  border: "#e2ddd4",
  borderDark: "#ccc6b8",
  ink: "#1a1814",
  inkMid: "#5a5448",
  inkLight: "#9c9488",
  inkFaint: "#c8c2b4",
  green: "#2d7a4f",
  greenLight: "#e8f5ee",
  greenMid: "#5aaa78",
  red: "#c0392b",
  redLight: "#fdf0ee",
  amber: "#d97706",
  amberLight: "#fef3c7",
  blue: "#1d4ed8",
  blueLight: "#eff6ff",
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
  protocol_for_use: "",
  location: "",
  notes: "",
  ...Object.fromEntries(METRICS.flatMap(m => [[`${m.id}_num`, ""], [`${m.id}_den`, ""]]))
});

const pct = (n, d) => {
  const nv = parseFloat(n), dv = parseFloat(d);
  if (!dv || isNaN(nv) || isNaN(dv)) return null;
  return Math.round((nv / dv) * 100);
};

const pctColor = (v) => {
  if (v === null) return C.inkLight;
  if (v >= 90) return C.green;
  if (v >= 70) return C.amber;
  return C.red;
};

const pctBg = (v) => {
  if (v === null) return C.surfaceAlt;
  if (v >= 90) return C.greenLight;
  if (v >= 70) return C.amberLight;
  return C.redLight;
};

const LINE_COLORS = ["#2d7a4f", "#1d4ed8", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];

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
            onFocus={e => e.target.style.borderColor = C.ink} onBlur={e => e.target.style.borderColor = C.border} />
        </div>
        <div style={{ paddingTop: 18, color: C.inkFaint, fontSize: 18 }}>÷</div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 4 }}>HAD APPLIED</label>
          <input type="number" min="0" value={num} onChange={e => onChange("num", e.target.value)} placeholder="0"
            style={{ width: "100%", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontSize: 16, fontFamily: "'Libre Baskerville', serif", color: C.ink, outline: "none" }}
            onFocus={e => e.target.style.borderColor = C.ink} onBlur={e => e.target.style.borderColor = C.border} />
        </div>
        <div style={{ paddingTop: 18 }}>
          <div style={{ background: pctBg(p), border: `1px solid ${p !== null ? pctColor(p) + "44" : C.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 60, textAlign: "center" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: p !== null ? pctColor(p) : C.inkFaint }}>
              {p !== null ? `${p}%` : "—"}
            </div>
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
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2, fontSize: 12 }}>
          <span style={{ color: C.inkMid }}>{p.name}: </span><strong>{p.value}%</strong>
        </div>
      ))}
    </div>
  );
};

export default function App() {
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
  const summaryRef = useRef(null);

  // ── Load all sessions from Supabase on mount ──────────────────────────────
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching sessions:", error);
        setDbError("Could not connect to database. Check your Supabase credentials in .env.local");
      } else {
        setEntries(data || []);
      }
      setLoading(false);
    };
    fetchSessions();
  }, []);

  const updateMetric = (id, field, val) => setForm(f => ({ ...f, [`${id}_${field}`]: val }));

  // ── Save new session to Supabase ──────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const payload = {
      date: form.date,
      location: form.location || null,
      protocol_for_use: form.protocol_for_use || null,
      notes: form.notes || null,
      ...Object.fromEntries(
        METRICS.flatMap(m => [
          [`${m.id}_num`, parseInt(form[`${m.id}_num`]) || null],
          [`${m.id}_den`, parseInt(form[`${m.id}_den`]) || null],
        ])
      ),
    };

    const { data, error } = await supabase
      .from("sessions")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Error saving session:", error);
      setSaveError("Failed to save. Check your connection and try again.");
      setSaving(false);
      return;
    }

    setEntries(prev => [...prev, data]);
    setForm(defaultForm());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Chart data derived from entries ──────────────────────────────────────
  const chartData = entries.map(e => {
    const row = { date: e.date?.slice(5) };
    METRICS.forEach(m => { row[m.label] = pct(e[`${m.id}_num`], e[`${m.id}_den`]); });
    return row;
  });

  const avgByMetric = METRICS.map(m => {
    const vals = entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return { ...m, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });

  // ── AI Summary via Claude API ─────────────────────────────────────────────
  const handleSummarize = async () => {
    if (!entries.length) return;
    setSummarizing(true);
    setSummary("");
    try {
      const rows = entries.map(e => {
        const mStr = METRICS.map(m => `${m.label}: ${pct(e[`${m.id}_num`], e[`${m.id}_den`]) ?? "N/A"}%`).join(", ");
        return `Date: ${e.date} | Location: ${e.location || "N/A"} | ${mStr}${e.notes ? ` | Notes: ${e.notes}` : ""}`;
      }).join("\n");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a clinical quality analyst reviewing wound care and pressure injury prevention compliance data. Analyze the following session-by-session data and provide:
1. Overall compliance trend (improving, declining, or stable)
2. Top performing metrics and which need the most attention
3. Notable patterns by location if applicable
4. 2-3 specific, actionable recommendations for the care team

Data:
${rows}

Keep your response clear, clinical, and practical. Under 250 words. Plain paragraphs only.`
          }]
        })
      });
      const data = await res.json();
      setSummary(data.content?.map(c => c.text || "").join("") || "Unable to generate summary.");
      setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setSummary("Error generating summary. Please check API connectivity.");
    }
    setSummarizing(false);
  };

  const Tab = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "10px 22px", background: "none", border: "none", cursor: "pointer",
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.08em",
      color: tab === id ? C.ink : C.inkLight,
      borderBottom: tab === id ? `2px solid ${C.ink}` : "2px solid transparent",
      transition: "all 0.15s"
    }}>{label}</button>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input,textarea { font-family: 'IBM Plex Sans', sans-serif; outline: none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 3px; }
        .savebtn:hover { background: ${C.ink} !important; color: white !important; }
        .summarize:hover { background: ${C.greenLight} !important; }
        .metric-toggle:hover { border-color: ${C.inkMid} !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "18px 0 0" }}>
            <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 20, fontWeight: 700 }}>CareTrack</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.15em" }}>WOUND CARE COMPLIANCE</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {loading && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.amber }}>● LOADING...</span>}
              {dbError && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.red }}>● DB ERROR</span>}
              {!loading && !dbError && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green }}>● CONNECTED</span>}
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight }}>{entries.length} SESSIONS</span>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 4 }}>
            <Tab id="log" label="LOG SESSION" />
            <Tab id="dashboard" label="DASHBOARD" />
            <Tab id="history" label="HISTORY" />
          </div>
        </div>
      </div>

      {/* DB Error Banner */}
      {dbError && (
        <div style={{ background: C.redLight, borderBottom: `1px solid #f5c6c2`, padding: "12px 32px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", fontSize: 13, color: C.red }}>
            ⚠ {dbError}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 32px 64px" }}>

        {/* ── LOG SESSION ── */}
        {tab === "log" && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400 }}>Log Session</h1>
              <p style={{ color: C.inkMid, fontSize: 13, marginTop: 4 }}>Enter the numerator (had applied) and denominator (qualifying patients) for each metric.</p>
            </div>

            {/* Protocol for Use */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>PROTOCOL FOR USE</label>
              <textarea value={form.protocol_for_use} onChange={e => setForm(f => ({ ...f, protocol_for_use: e.target.value }))}
                placeholder="Describe the protocol or intended use for this session..."
                rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = C.ink} onBlur={e => e.target.style.borderColor = C.border} />
            </div>

            {/* Session info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>DATE</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink }}
                  onFocus={e => e.target.style.borderColor = C.ink} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>LOCATION / UNIT</label>
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. 3 North, ICU, 4 South"
                  style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink }}
                  onFocus={e => e.target.style.borderColor = C.ink} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            </div>

            {/* Metric inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {METRICS.map(m => (
                <MetricInput key={m.id} metric={m}
                  num={form[`${m.id}_num`]} den={form[`${m.id}_den`]}
                  onChange={(field, val) => updateMetric(m.id, field, val)} />
              ))}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 }}>NOTES (OPTIONAL)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observations, context, follow-up actions..."
                rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: C.ink, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = C.ink} onBlur={e => e.target.style.borderColor = C.border} />
            </div>

            {saveError && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: C.redLight, border: `1px solid #f5c6c2`, borderRadius: 8, fontSize: 13, color: C.red }}>
                ⚠ {saveError}
              </div>
            )}

            <button className="savebtn" onClick={handleSave} disabled={saving || !!dbError}
              style={{ background: saved ? C.greenLight : C.surfaceAlt, border: `1px solid ${saved ? C.green : C.borderDark}`, borderRadius: 8, padding: "12px 28px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: saved ? C.green : C.ink, cursor: saving || dbError ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: saving ? 0.6 : 1 }}>
              {saved ? "✓ SESSION SAVED" : saving ? "SAVING..." : "SAVE SESSION →"}
            </button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400, marginBottom: 4 }}>Compliance Dashboard</h1>
              <p style={{ color: C.inkMid, fontSize: 13 }}>
                {loading ? "Loading sessions..." : `Average compliance across all ${entries.length} logged sessions.`}
              </p>
            </div>

            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                Loading data from database...
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
                  {avgByMetric.map(m => (
                    <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                      <div style={{ fontSize: 11, color: C.inkLight, lineHeight: 1.4, marginBottom: 10 }}>{m.label}</div>
                      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 28, fontWeight: 700, color: m.avg !== null ? pctColor(m.avg) : C.inkFaint }}>
                        {m.avg !== null ? `${m.avg}%` : "—"}
                      </div>
                      <div style={{ marginTop: 8, height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${m.avg ?? 0}%`, background: m.avg !== null ? pctColor(m.avg) : C.inkFaint, borderRadius: 2, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trend chart */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.inkLight, letterSpacing: "0.1em", marginBottom: 4 }}>COMPLIANCE TRENDS OVER TIME</div>
                      <div style={{ fontSize: 12, color: C.inkMid }}>Select metrics to display</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {METRICS.map((m, i) => {
                        const active = selectedMetrics.includes(m.id);
                        return (
                          <button key={m.id} className="metric-toggle" onClick={() => setSelectedMetrics(prev => active ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                            style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.15s", border: `1px solid ${active ? LINE_COLORS[i] : C.border}`, background: active ? LINE_COLORS[i] + "18" : "none", color: active ? LINE_COLORS[i] : C.inkLight, letterSpacing: "0.05em" }}>
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {entries.length === 0 ? (
                    <div style={{ padding: "40px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No sessions logged yet. Add your first session to see trends.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -15 }}>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: C.inkLight, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: C.inkLight, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        {METRICS.map((m, i) => selectedMetrics.includes(m.id) && (
                          <Line key={m.id} type="monotone" dataKey={m.label} stroke={LINE_COLORS[i]} strokeWidth={2} dot={{ fill: LINE_COLORS[i], r: 3 }} activeDot={{ r: 5 }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* AI Summary */}
                <div>
                  <button className="summarize" onClick={handleSummarize} disabled={summarizing || entries.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 20px", color: C.ink, cursor: entries.length === 0 ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", transition: "all 0.2s", opacity: summarizing || entries.length === 0 ? 0.5 : 1 }}>
                    <span>✦</span> {summarizing ? "ANALYZING..." : "GENERATE AI CLINICAL SUMMARY"}
                  </button>
                  {(summary || summarizing) && (
                    <div ref={summaryRef} style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`, borderRadius: "0 10px 10px 0", padding: "20px 24px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.green, letterSpacing: "0.1em", marginBottom: 12 }}>✦ AI CLINICAL ANALYSIS</div>
                      {summarizing
                        ? <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}<style>{`@keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}`}</style></div>
                        : <p style={{ fontSize: 14, lineHeight: 1.8, color: C.inkMid, whiteSpace: "pre-wrap" }}>{summary}</p>
                      }
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, fontWeight: 400 }}>Session History</h1>
            </div>
            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>Loading...</div>
            ) : entries.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: C.inkLight, fontSize: 13 }}>No sessions logged yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...entries].reverse().map(e => {
                  const metrics = METRICS.map(m => ({ label: m.label, p: pct(e[`${m.id}_num`], e[`${m.id}_den`]), num: e[`${m.id}_num`], den: e[`${m.id}_den`] }));
                  return (
                    <div key={e.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 16, fontWeight: 700 }}>{e.date}</div>
                          {e.location && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{e.location}</div>}
                          {e.protocol_for_use && <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4, fontStyle: "italic" }}>Protocol: {e.protocol_for_use}</div>}
                        </div>
                        {e.notes && <div style={{ fontSize: 12, color: C.inkMid, maxWidth: 360, textAlign: "right", lineHeight: 1.5, fontStyle: "italic" }}>{e.notes}</div>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                        {metrics.map(m => (
                          <div key={m.label} style={{ background: pctBg(m.p), border: `1px solid ${m.p !== null ? pctColor(m.p) + "33" : C.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginBottom: 4, lineHeight: 1.3 }}>{m.label}</div>
                            <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, fontWeight: 700, color: m.p !== null ? pctColor(m.p) : C.inkFaint }}>
                              {m.p !== null ? `${m.p}%` : "—"}
                            </div>
                            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: C.inkLight, marginTop: 2 }}>
                              {m.num}/{m.den}
                            </div>
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
      </div>
    </div>
  );
}

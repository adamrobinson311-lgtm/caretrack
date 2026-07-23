// api/render-dashboard-pdf.js
// Server-side dashboard PDF generation for scheduled auto-reports.
// Called by the send-scheduled-reports Edge Function with { scheduleId }.
// Pulls sessions + branding from Supabase, runs generatePdf, returns base64.

const { createClient } = require("@supabase/supabase-js");

// generatePdf.js is an ES module — require it via dynamic import wrapper
let _generatePdfPromise = null;
const loadGeneratePdf = () => {
  if (!_generatePdfPromise) _generatePdfPromise = import("../src/generatePdf.js");
  return _generatePdfPromise;
};

const METRICS = [
  { id: "matt_applied",     label: "Matt Applied" },
  { id: "wedges_applied",   label: "Wedges Applied" },
  { id: "turning_criteria", label: "Turning & Repositioning" },
  { id: "matt_proper",      label: "Matt Applied Properly" },
  { id: "wedges_in_room",   label: "Wedges in Room" },
  { id: "wedge_offload",    label: "Proper Wedge Offloading" },
  { id: "air_supply",       label: "Air Supply in Room" },
];

// ── PAGINATED FETCH ──────────────────────────────────────────────────────────
// PostgREST silently caps every unbounded .select() at 1,000 rows — no error,
// no warning. The sessions table is past 1,800, so a full-table read returned
// roughly half the data. This endpoint filters by hospital AFTER fetching, so
// the loss compounded: Northwell LIJ reported 589 of its 1,130 sessions.
// The .order() is required — without a stable sort, .range() pages can skip or
// duplicate rows as the table changes underneath the loop.
const fetchAllRows = async (supabase, table, columns = "*") => {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
};

// sessions.date is a plain calendar date with no timezone. Cutoffs must be
// computed on the Eastern calendar or the boundary lands on the wrong day.
// Noon-UTC arithmetic is immune to DST and to the host's timezone.
const easternIsoDate = (now = new Date()) => {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).reduce((acc, x) => (x.type !== "literal" && (acc[x.type] = x.value), acc), {});
  return `${p.year}-${p.month}-${p.day}`;
};

const shiftIsoDate = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const pct = (n, d) => {
  const nv = parseFloat(n), dv = parseFloat(d);
  if (!dv || isNaN(nv) || isNaN(dv)) return null;
  return Math.round((nv / dv) * 100);
};

// Filter sessions by schedule's hospital list + period (mirrors send-scheduled-reports)
const filterSessions = (allSessions, hospitals, period) => {
  const todayIso = easternIsoDate();
  let cutoff = null;
  if (period === "7d")       cutoff = shiftIsoDate(todayIso, -7);
  else if (period === "30d") cutoff = shiftIsoDate(todayIso, -30);
  else if (period === "mtd") cutoff = `${todayIso.slice(0, 7)}-01`;
  return allSessions.filter(e => {
    if (!hospitals.includes(e.hospital)) return false;
    if (cutoff && e.date < cutoff) return false;
    return true;
  });
};

// Build chartData (mirrors App.jsx:2242)
const buildChartData = (filtered) => filtered.map(e => {
  const row = { date: e.date?.slice(5) };
  METRICS.forEach(m => { row[m.label] = pct(e[`${m.id}_num`], e[`${m.id}_den`]); });
  return row;
});

// Build momData (mirrors App.jsx:2266)
const buildMomData = (filtered) => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear  = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear  = thisMonth === 0 ? thisYear - 1 : thisYear;

  const inMonth = (e, m, y) => {
    if (!e.date) return false;
    const [yy, mm] = e.date.split("-").map(Number);
    return mm - 1 === m && yy === y;
  };
  const thisEntries = filtered.filter(e => inMonth(e, thisMonth, thisYear));
  const lastEntries = filtered.filter(e => inMonth(e, lastMonth, lastYear));

  const avg = (arr) => {
    const vals = METRICS.flatMap(m => arr.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const metricAvg = (arr, m) => {
    const vals = arr.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const thisAvg = avg(thisEntries);
  const lastAvg = avg(lastEntries);
  const delta = thisAvg !== null && lastAvg !== null ? thisAvg - lastAvg : null;

  const metricDeltas = METRICS.map(m => {
    const t = metricAvg(thisEntries, m);
    const l = metricAvg(lastEntries, m);
    return { ...m, this: t, last: l, delta: t !== null && l !== null ? t - l : null };
  });

  const monthName = (m, y) => new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return {
    thisMonth: monthName(thisMonth, thisYear),
    lastMonth: monthName(lastMonth, lastYear),
    thisAvg, lastAvg, delta,
    thisSessions: thisEntries.length,
    lastSessions: lastEntries.length,
    metricDeltas,
    hasData: thisEntries.length > 0 || lastEntries.length > 0,
  };
};

// Fetch image at a URL → base64 + dimensions (for branding logo)
const fetchLogo = async (logoUrl) => {
  if (!logoUrl) return null;
  try {
    const resp = await fetch(logoUrl);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const mime = (resp.headers.get("content-type") || "image/png").split("/")[1] || "png";
    // jsPDF accepts the dimensions of the source — best-effort defaults if we
    // can't probe them server-side (jsdom Image doesn't load network bytes).
    // The PDF will scale proportionally either way; defaults are safe.
    return { logoBase64: buf.toString("base64"), logoMime: mime, logoWidth: 300, logoHeight: 100 };
  } catch (err) {
    console.warn("Logo fetch failed:", err.message);
    return null;
  }
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Light auth — require the same shared secret the Edge Function uses
  const expected = process.env.RENDER_PDF_SECRET;
  const got = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (expected && got !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { scheduleId } = req.body || {};
    if (!scheduleId) return res.status(400).json({ error: "scheduleId required" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Load the schedule
    const { data: sched, error: schedErr } = await supabase
      .from("report_schedules")
      .select("*")
      .eq("id", scheduleId)
      .single();
    if (schedErr || !sched) return res.status(404).json({ error: "Schedule not found" });

    const hospitals = sched.hospitals || [];
    if (!hospitals.length) return res.status(400).json({ error: "Schedule has no hospitals" });

    // Load all sessions, then filter
    const allSessions = await fetchAllRows(supabase, "sessions", "*");
    const filtered = filterSessions(allSessions, hospitals, sched.period || "30d");

    // Load branding for the FIRST hospital in the list (cover/colors).
    // For multi-hospital combined PDFs, we use the first hospital's branding
    // as the "lead" — it sets logo + accent colors on the cover.
    const { data: branding } = await supabase
      .from("hospital_branding")
      .select("*")
      .eq("hospital", hospitals[0])
      .maybeSingle();

    // Branding object as generatePdf expects it
    let brandingPayload = null;
    if (branding) {
      brandingPayload = {
        logoUrl:        branding.logo_url,
        accentColor:    branding.primary_color,
        secondaryColor: branding.secondary_color,
        tertiaryColor:  branding.tertiary_color,
        textColor:      branding.text_color,
        coverColor:     branding.cover_color,
        // Per-schedule metric selection wins over per-hospital. Falls back to
        // hospital's enabled_metrics if schedule.metrics is null, then to all.
        enabledMetrics: sched.metrics || branding.enabled_metrics || null,
      };
      // Fetch and embed the logo
      const logoData = await fetchLogo(branding.logo_url);
      if (logoData) brandingPayload = { ...brandingPayload, ...logoData };
    } else if (sched.metrics) {
      brandingPayload = { enabledMetrics: sched.metrics };
    }

    // Build chartData + momData
    const chartData = buildChartData(filtered);
    const momData = buildMomData(filtered);

    // exportLabel: use schedule name if multi-hospital, otherwise the hospital
    const exportLabel = hospitals.length === 1 ? hospitals[0] : sched.name;

    // Run generatePdf, get base64
    const { generatePdf } = await loadGeneratePdf();
    const pdfBase64 = await generatePdf(
      filtered,
      "",                    // summary — no AI summary in scheduled reports
      true,                  // returnBase64
      exportLabel,
      "Auto Report",         // preparedBy
      brandingPayload,
      chartData,
      momData,
      allSessions,           // allEntries (for national avg)
      filtered               // fullEntries (for per-hospital MoM)
    );

    return res.status(200).json({
      ok: true,
      pdfBase64,
      sessionCount: filtered.length,
      hospitalCount: hospitals.length,
    });
  } catch (err) {
    console.error("render-dashboard-pdf error:", err);
    return res.status(500).json({ error: "Failed to render PDF", detail: String(err?.message || err) });
  }
};

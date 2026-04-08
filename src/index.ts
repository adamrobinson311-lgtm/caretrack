import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "CareTrack Reports <noreply@hovertechinternational.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const pct = (n: any, d: any) => {
  const nv = parseFloat(n), dv = parseFloat(d);
  if (!dv || isNaN(nv) || isNaN(dv)) return null;
  return Math.round((nv / dv) * 100);
};

const pctColor = (v: number | null) => {
  if (v === null) return "#888780";
  if (v >= 90) return "#3a7d5c";
  if (v >= 70) return "#8a6a2a";
  return "#9e3a3a";
};

const pctBar = (v: number | null) => {
  const w = v ?? 0;
  const color = pctColor(v);
  return `<div style="height:6px;background:#ede9e7;border-radius:3px;overflow:hidden;margin-top:4px;">
    <div style="height:100%;width:${w}%;background:${color};border-radius:3px;"></div>
  </div>`;
};

const getFilteredSessions = (allSessions: any[], hospitals: string[], period: string) => {
  const now = new Date();
  let cutoff: string | null = null;
  if (period === "7d") cutoff = new Date(now.getTime() - 7*86400000).toISOString().slice(0,10);
  else if (period === "30d") cutoff = new Date(now.getTime() - 30*86400000).toISOString().slice(0,10);
  else if (period === "mtd") cutoff = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);

  return allSessions.filter((e: any) => {
    if (!hospitals.includes(e.hospital)) return false;
    if (cutoff && e.date < cutoff) return false;
    return true;
  });
};

const periodLabel = (period: string) => ({
  "7d": "Last 7 Days", "30d": "Last 30 Days", "mtd": "Month to Date", "all": "All Time"
}[period] || period);

const buildReportHtml = (sched: any, sessions: any[], hasPdf: boolean) => {
  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const hospitals = sched.hospitals as string[];

  const avgMetrics = METRICS.map(m => {
    const vals = sessions.map((e: any) => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null) as number[];
    const avg = vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null;
    return { ...m, avg };
  });

  const overallVals = avgMetrics.map(m => m.avg).filter(v => v !== null) as number[];
  const overall = overallVals.length ? Math.round(overallVals.reduce((a,b) => a+b,0) / overallVals.length) : null;

  const hospitalCards = hospitals.map(h => {
    const hSessions = sessions.filter((e: any) => e.hospital === h);
    const hMetrics = METRICS.map(m => {
      const vals = hSessions.map((e: any) => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null) as number[];
      return { ...m, avg: vals.length ? Math.round(vals.reduce((a,b) => a+b,0)/vals.length) : null };
    });
    const hOverallVals = hMetrics.map(m => m.avg).filter(v => v !== null) as number[];
    const hOverall = hOverallVals.length ? Math.round(hOverallVals.reduce((a,b) => a+b,0)/hOverallVals.length) : null;
    return { hospital: h, sessions: hSessions.length, metrics: hMetrics, overall: hOverall };
  });

  const recent = [...sessions].sort((a: any,b: any) => (b.date||"").localeCompare(a.date||"")).slice(0,30);
  const histRows = recent.map((e: any) => `
    <tr>
      <td style="padding:6px 10px;font-size:11px;color:#2a2624;border-top:1px solid #ede9e7;">${e.date || "—"}</td>
      <td style="padding:6px 10px;font-size:11px;color:#2a2624;border-top:1px solid #ede9e7;">${e.hospital || "—"}</td>
      <td style="padding:6px 10px;font-size:11px;color:#2a2624;border-top:1px solid #ede9e7;">${e.location || "—"}</td>
      <td style="padding:6px 10px;font-size:11px;color:#2a2624;border-top:1px solid #ede9e7;">${e.logged_by || "—"}</td>
      ${METRICS.slice(0,4).map(m => { const v = pct(e[`${m.id}_num`],e[`${m.id}_den`]); return `<td style="padding:6px 10px;font-size:11px;text-align:center;color:${pctColor(v)};border-top:1px solid #ede9e7;font-weight:700;">${v!==null?`${v}%`:"—"}</td>`; }).join("")}
    </tr>`).join("");

  const metricRows = avgMetrics.map(m => `
    <tr>
      <td style="padding:8px 12px;font-size:12px;color:#2a2624;font-family:Arial,sans-serif;border-top:1px solid #ede9e7;">${m.label}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:${pctColor(m.avg)};font-family:Arial,sans-serif;border-top:1px solid #ede9e7;text-align:center;">${m.avg!==null?`${m.avg}%`:"—"}</td>
      <td style="padding:8px 12px;border-top:1px solid #ede9e7;">${pctBar(m.avg)}</td>
    </tr>`).join("");

  const hospitalCompRows = hospitalCards.map(h => `
    <tr>
      <td style="padding:8px 12px;font-size:12px;color:#2a2624;font-family:Arial,sans-serif;border-top:1px solid #ede9e7;">${h.hospital}</td>
      <td style="padding:8px 12px;font-size:12px;color:#7C7270;font-family:Arial,sans-serif;border-top:1px solid #ede9e7;text-align:center;">${h.sessions}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:${pctColor(h.overall)};font-family:Arial,sans-serif;border-top:1px solid #ede9e7;text-align:center;">${h.overall!==null?`${h.overall}%`:"—"}</td>
    </tr>`).join("");

  const statCards = [
    { label:"Sessions", value: String(sessions.length), color:"#4F6E77" },
    { label:"Hospitals", value: String(hospitals.length), color:"#4F6E77" },
    { label:"Avg Compliance", value: overall!==null?`${overall}%`:"—", color: pctColor(overall) },
    { label:"Period", value: periodLabel(sched.period), color:"#7C7270" },
  ].map(s => `
    <td width="25%" style="padding:0 5px;">
      <div style="background:#f5f3f1;border-radius:8px;padding:14px;text-align:center;">
        <p style="margin:0 0 4px;font-size:9px;color:#7C7270;letter-spacing:1px;font-family:Arial,sans-serif;">${s.label.toUpperCase()}</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:${s.color};font-family:Arial,sans-serif;">${s.value}</p>
      </div>
    </td>`).join("");

  const pdfNote = hasPdf
    ? `<p style="margin:8px 0 0;font-size:11px;color:#4F6E77;"><strong>📎 PDF report attached</strong> — see the attachment for the full formatted report.</p>`
    : `<p style="margin:8px 0 0;font-size:11px;color:#7C7270;">Log in to <a href="https://caretrack-puce.vercel.app" style="color:#4F6E77;">CareTrack</a> to download the full PDF report.</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f3f1;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f1;padding:40px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #cec9c7;">

        <!-- Header -->
        <tr><td style="background:#4F6E77;padding:28px 36px;">
          <p style="margin:0;font-size:11px;color:#a8c8d0;letter-spacing:3px;font-weight:600;font-family:Arial,sans-serif;">HOVERTECH INTERNATIONAL · AN ETAC COMPANY</p>
          <p style="margin:6px 0 0;font-size:26px;color:#ffffff;font-weight:700;font-family:Arial,sans-serif;">CareTrack</p>
          <p style="margin:2px 0 0;font-size:13px;color:#a8c8d0;font-family:Arial,sans-serif;">${sched.name}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#7ca8b4;font-family:Arial,sans-serif;">Generated ${today} · ${periodLabel(sched.period)}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px;">

          <!-- Stat cards -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr>${statCards}</tr></table>

          <!-- PDF note -->
          <div style="background:#f0f5f6;border:1px solid #c8dde2;border-radius:8px;padding:12px 16px;margin-bottom:28px;">
            ${pdfNote}
          </div>

          <!-- Compliance Summary -->
          <p style="margin:0 0 6px;font-size:10px;color:#7C7270;letter-spacing:1px;font-weight:600;">COMPLIANCE SUMMARY — ALL METRICS</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ede9e7;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <tr style="background:#f5f3f1;">
              <th style="padding:8px 12px;font-size:10px;color:#7C7270;text-align:left;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">METRIC</th>
              <th style="padding:8px 12px;font-size:10px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">AVG %</th>
              <th style="padding:8px 12px;font-size:10px;color:#7C7270;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;width:200px;">TREND</th>
            </tr>
            ${metricRows}
          </table>

          ${hospitals.length > 1 ? `
          <!-- Hospital Comparison -->
          <p style="margin:0 0 6px;font-size:10px;color:#7C7270;letter-spacing:1px;font-weight:600;">HOSPITAL COMPARISON</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ede9e7;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <tr style="background:#f5f3f1;">
              <th style="padding:8px 12px;font-size:10px;color:#7C7270;text-align:left;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">HOSPITAL</th>
              <th style="padding:8px 12px;font-size:10px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">SESSIONS</th>
              <th style="padding:8px 12px;font-size:10px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">AVG %</th>
            </tr>
            ${hospitalCompRows}
          </table>` : ""}

          <!-- Session History -->
          <p style="margin:0 0 6px;font-size:10px;color:#7C7270;letter-spacing:1px;font-weight:600;">SESSION LOG${sessions.length > 30 ? ` (MOST RECENT 30 OF ${sessions.length})` : ""}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ede9e7;border-radius:8px;overflow:hidden;margin-bottom:28px;font-size:11px;">
            <tr style="background:#f5f3f1;">
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:left;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">DATE</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:left;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">HOSPITAL</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:left;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">UNIT</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:left;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">REP</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">MATT</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">WEDGE</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">TURN</th>
              <th style="padding:6px 10px;font-size:9px;color:#7C7270;text-align:center;letter-spacing:1px;font-weight:600;font-family:Arial,sans-serif;">PROP</th>
            </tr>
            ${histRows}
          </table>

          <!-- Footer note -->
          <hr style="border:none;border-top:1px solid #ede9e7;margin:0 0 20px;">
          <p style="margin:0;font-size:11px;color:#7C7270;">This report was automatically generated by <strong>CareTrack</strong> and sent on behalf of HoverTech International.</p>
          <p style="margin:8px 0 0;font-size:11px;color:#7C7270;">Questions? Contact <strong>Elizabeth Doherty</strong> — CareTrack Administrator<br>
          <a href="mailto:edoherty@hovertechinternational.com" style="color:#4F6E77;">edoherty@hovertechinternational.com</a></p>

        </td></tr>

        <!-- Footer bar -->
        <tr><td style="background:#f5f3f1;padding:16px 36px;border-top:1px solid #ede9e7;">
          <p style="margin:0;font-size:10px;color:#c0bbb9;text-align:center;font-family:Arial,sans-serif;">HoverTech International · an Etac Company · CareTrack</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
};

const isDueToday = (sched: any, now: Date): boolean => {
  if (!sched.is_active) return false;
  if (sched.frequency === "monthly") {
    return now.getDate() === sched.day_of_month;
  }
  if (sched.frequency === "weekly") {
    return now.getDay() === sched.day_of_week;
  }
  return false;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { scheduleId, preview = false, pdfBase64 = null } = body;

    // Load schedules — either specific one (Send Now) or all due today
    let schedules: any[] = [];
    if (scheduleId) {
      const { data } = await supabase.from("report_schedules").select("*").eq("id", scheduleId).single();
      if (data) schedules = [data];
    } else {
      const now = new Date();
      const { data } = await supabase.from("report_schedules").select("*").eq("is_active", true);
      schedules = (data || []).filter(s => isDueToday(s, now));
    }

    if (!schedules.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No schedules due" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all sessions once
    const { data: allSessions } = await supabase.from("sessions").select("*");
    const sessions = allSessions || [];

    const dateStr = new Date().toISOString().slice(0, 10);
    let sent = 0;

    for (const sched of schedules) {
      const filtered = getFilteredSessions(sessions, sched.hospitals || [], sched.period || "30d");
      const hasPdf = !!pdfBase64;
      const html = buildReportHtml(sched, filtered, hasPdf);
      const periodLbl = periodLabel(sched.period);
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const subject = `CareTrack: ${sched.name} — ${periodLbl} · ${today}`;

      // Build Resend payload — attach PDF if provided
      const hospitalSlug = (sched.hospitals || []).join("_").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").slice(0, 40);
      const emailPayload: any = {
        from: FROM,
        to: sched.recipients || [],
        subject,
        html,
      };

      if (pdfBase64) {
        emailPayload.attachments = [{
          filename: `CareTrack_${hospitalSlug}_${dateStr}.pdf`,
          content: pdfBase64,
          type: "application/pdf",
        }];
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

      if (res.ok) {
        sent++;
        await supabase.from("report_schedules").update({ last_sent: new Date().toISOString() }).eq("id", sched.id);
      } else {
        const err = await res.text();
        console.error(`Failed to send schedule ${sched.id}:`, err);
        throw new Error(`Resend error: ${err}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, schedules: schedules.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-scheduled-reports error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

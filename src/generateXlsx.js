import * as XLSX from "xlsx";

const METRICS = [
  { id: "matt_applied", label: "Matt Applied" },
  { id: "wedges_applied", label: "Wedges Applied" },
  { id: "turning_criteria", label: "Turning & Repositioning" },
  { id: "matt_proper", label: "Matt Applied Properly" },
  { id: "wedges_in_room", label: "Wedges in Room" },
  { id: "wedge_offload", label: "Proper Wedge Offloading" },
  { id: "air_supply", label: "Air Supply in Room" },
];

const pct = (n, d) => {
  const nv = parseFloat(n), dv = parseFloat(d);
  if (!dv || isNaN(nv) || isNaN(dv)) return null;
  return Math.round((nv / dv) * 100);
};

const today = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function generateXlsx(entries, hospitalFilter = "", preparedBy = "") {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: "CareTrack Compliance Report",
    Author: preparedBy || "HoverTech CareTrack",
    CreatedDate: new Date(),
  };

  // ── SHEET 1: SUMMARY ──────────────────────────────────────────────────────
  const summaryData = [];

  summaryData.push(["CareTrack — Wound Care Compliance Report"]);
  summaryData.push([`Generated: ${today()}`]);
  if (preparedBy) summaryData.push([`Prepared by: ${preparedBy}`]);
  if (hospitalFilter && hospitalFilter !== "All") summaryData.push([`Hospital Filter: ${hospitalFilter}`]);
  summaryData.push([`Total Sessions: ${entries.length}`]);
  summaryData.push([]);

  // Overall average
  const allVals = METRICS.flatMap(m => entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
  const overallAvg = allVals.length ? Math.round(allVals.reduce((a, b) => a + b, 0) / allVals.length) : null;
  summaryData.push(["OVERALL AVERAGE COMPLIANCE", overallAvg !== null ? `${overallAvg}%` : "—"]);
  summaryData.push([]);

  // Per-metric summary
  summaryData.push(["METRIC", "AVERAGE", "SESSIONS WITH DATA", "NUMERATOR TOTAL", "DENOMINATOR TOTAL"]);
  METRICS.forEach(m => {
    const vals = entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const numTotal = entries.reduce((s, e) => s + (parseFloat(e[`${m.id}_num`]) || 0), 0);
    const denTotal = entries.reduce((s, e) => s + (parseFloat(e[`${m.id}_den`]) || 0), 0);
    summaryData.push([m.label, avg !== null ? `${avg}%` : "—", vals.length, numTotal, denTotal]);
  });

  summaryData.push([]);

  // Per-hospital breakdown
  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  if (hospitals.length > 1) {
    summaryData.push(["HOSPITAL BREAKDOWN"]);
    summaryData.push(["HOSPITAL", "SESSIONS", "OVERALL AVG", ...METRICS.map(m => m.label)]);
    hospitals.forEach(h => {
      const hEntries = entries.filter(e => e.hospital === h);
      const hVals = METRICS.flatMap(m => hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
      const hAvg = hVals.length ? Math.round(hVals.reduce((a, b) => a + b, 0) / hVals.length) : null;
      const metricAvgs = METRICS.map(m => {
        const vals = hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
        return vals.length ? `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%` : "—";
      });
      summaryData.push([h, hEntries.length, hAvg !== null ? `${hAvg}%` : "—", ...metricAvgs]);
    });
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Column widths for summary
  summarySheet["!cols"] = [
    { wch: 35 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // ── SHEET 2: RAW SESSIONS ─────────────────────────────────────────────────
  const headers = [
    "Date",
    "Submitted At",
    "Hospital",
    "Location",
    "Protocol",
    "Logged By",
    "Notes",
    ...METRICS.flatMap(m => [`${m.label} (Num)`, `${m.label} (Den)`, `${m.label} (%)`]),
    "Overall %",
  ];

  const rows = entries.map(e => {
    const metricCols = METRICS.flatMap(m => {
      const num = e[`${m.id}_num`] ?? "";
      const den = e[`${m.id}_den`] ?? "";
      const p = pct(num, den);
      return [num, den, p !== null ? `${p}%` : "—"];
    });
    const overallVals = METRICS.map(m => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    const overall = overallVals.length ? Math.round(overallVals.reduce((a, b) => a + b, 0) / overallVals.length) : null;
    return [
      e.date || "",
      e.created_at ? new Date(e.created_at).toLocaleString("en-US") : "",
      e.hospital || "",
      e.location || "",
      e.protocol_for_use || "",
      e.logged_by || "",
      e.notes || "",
      ...metricCols,
      overall !== null ? `${overall}%` : "—",
    ];
  });

  const sessionsSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths for sessions
  sessionsSheet["!cols"] = [
    { wch: 12 }, { wch: 20 }, { wch: 28 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 30 },
    ...METRICS.flatMap(() => [{ wch: 8 }, { wch: 8 }, { wch: 10 }]),
    { wch: 12 },
  ];

  // Freeze top row
  sessionsSheet["!freeze"] = { xSplit: "0", ySplit: "1", topLeftCell: "A2", activePane: "bottomLeft" };

  XLSX.utils.book_append_sheet(wb, sessionsSheet, "Raw Sessions");

  // ── DOWNLOAD ──────────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  const hospitalSlug = hospitalFilter && hospitalFilter !== "All"
    ? "_" + hospitalFilter.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_")
    : "";
  XLSX.writeFile(wb, `CareTrack_Report${hospitalSlug}_${dateStr}.xlsx`);
}

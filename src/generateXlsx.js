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

const MAYO_METRICS = [
  { id: "air_reposition", label: "Air Used to Reposition Patient" },
];

const KAISER_METRICS = [
  { id: "heel_boots", label: "Heel Boots On" },
  { id: "turn_clock", label: "Turn Clock" },
];
const isMayo   = (hospital) => hospital && hospital.toLowerCase().includes("mayo");
const isKaiser = (hospital) => hospital && hospital.toLowerCase().includes("kaiser");
const getMetrics = (hospital) => [
  ...METRICS,
  ...(isMayo(hospital)   ? MAYO_METRICS   : []),
  ...(isKaiser(hospital) ? KAISER_METRICS : []),
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

  // Determine if any entries are from Mayo hospitals — include Mayo metric in summary if so
  const hasMayo   = entries.some(e => isMayo(e.hospital));
  const hasKaiser = entries.some(e => isKaiser(e.hospital));
  const summaryMetrics = [
    ...METRICS,
    ...(hasMayo   ? MAYO_METRICS   : []),
    ...(hasKaiser ? KAISER_METRICS : []),
  ];

  // ── SHEET 1: SUMMARY ──────────────────────────────────────────────────────
  const summaryData = [];

  summaryData.push(["CareTrack — Wound Care Compliance Report"]);
  summaryData.push([`Generated: ${today()}`]);
  if (preparedBy) summaryData.push([`Prepared by: ${preparedBy}`]);
  if (hospitalFilter && hospitalFilter !== "All") summaryData.push([`Hospital Filter: ${hospitalFilter}`]);
  summaryData.push([`Total Sessions: ${entries.length}`]);
  summaryData.push([]);

  // Overall average
  const allVals = summaryMetrics.flatMap(m => entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
  const overallAvg = allVals.length ? Math.round(allVals.reduce((a, b) => a + b, 0) / allVals.length) : null;
  summaryData.push(["OVERALL AVERAGE COMPLIANCE", overallAvg !== null ? `${overallAvg}%` : "—"]);
  summaryData.push([]);

  // Per-metric summary
  summaryData.push(["METRIC", "AVERAGE", "SESSIONS WITH DATA", "NUMERATOR TOTAL", "DENOMINATOR TOTAL"]);
  summaryMetrics.forEach(m => {
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
    summaryData.push(["HOSPITAL", "SESSIONS", "OVERALL AVG", ...summaryMetrics.map(m => m.label)]);
    hospitals.forEach(h => {
      const hEntries = entries.filter(e => e.hospital === h);
      const hMetrics = getMetrics(h);
      const hVals = hMetrics.flatMap(m => hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
      const hAvg = hVals.length ? Math.round(hVals.reduce((a, b) => a + b, 0) / hVals.length) : null;
      const metricAvgs = summaryMetrics.map(m => {
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
    "Date", "Submitted At", "Hospital", "Location", "Protocol", "Logged By", "Notes",
    ...summaryMetrics.flatMap(m => [`${m.label} (Num)`, `${m.label} (Den)`, `${m.label} (%)`]),
    "Overall %",
  ];

  const rows = entries.map(e => {
    const entryMetrics = getMetrics(e.hospital);
    const metricCols = summaryMetrics.flatMap(m => {
      // Only show values for metrics relevant to this entry's hospital
      if (!entryMetrics.find(x => x.id === m.id)) return ["—", "—", "—"];
      const num = e[`${m.id}_num`] ?? "";
      const den = e[`${m.id}_den`] ?? "";
      const p = pct(num, den);
      return [num, den, p !== null ? `${p}%` : "—"];
    });
    const overallVals = entryMetrics.map(m => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    const overall = overallVals.length ? Math.round(overallVals.reduce((a, b) => a + b, 0) / overallVals.length) : null;
    return [
      e.date || "", e.created_at ? new Date(e.created_at).toLocaleString("en-US") : "",
      e.hospital || "", e.location || "", e.protocol_for_use || "", e.logged_by || "", e.notes || "",
      ...metricCols, overall !== null ? `${overall}%` : "—",
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

  // ── SHEET 3: PER BED DETAIL (if any sessions have bed_data) ─────────────
  const bedEntries = entries.filter(e => e.bed_data && Array.isArray(e.bed_data) && e.bed_data.length > 0);
  if (bedEntries.length > 0) {
    const allSessionMetrics = [...new Set(bedEntries.flatMap(e => getMetrics(e.hospital).map(m => m.id)))];
    const metaLabels = allSessionMetrics.flatMap(id => {
      const m = [...METRICS, ...MAYO_METRICS, ...KAISER_METRICS].find(x => x.id === id);
      const label = m ? m.label : id;
      return [`${label} (Qual)`, `${label} (Adh)`, `${label} (%)`];
    });
    const bedHeaders = ["Date", "Hospital", "Location", "Bed #", "Room", "Bed N/A", ...metaLabels];
    const bedRows = [];
    bedEntries.forEach(e => {
      e.bed_data.forEach((bed, idx) => {
        const metricCols = allSessionMetrics.flatMap(id => {
          if (bed.na) return ["N/A", "N/A", "N/A"];
          const q = parseFloat(bed[`${id}_q`]) || 0;
          const a = parseFloat(bed[`${id}_a`]) || 0;
          if (bed[`${id}_na`]) return ["N/A", "N/A", "N/A"];
          const p = q > 0 ? Math.round((a / q) * 100) : null;
          return [q || "", a || "", p !== null ? `${p}%` : "—"];
        });
        bedRows.push([e.date || "", e.hospital || "", e.location || "", idx + 1, bed.room || "", bed.na ? "Yes" : "No", ...metricCols]);
      });
    });
    const bedSheet = XLSX.utils.aoa_to_sheet([bedHeaders, ...bedRows]);
    bedSheet["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, ...metaLabels.map(() => ({ wch: 10 }))];
    bedSheet["!freeze"] = { xSplit: "0", ySplit: "1", topLeftCell: "A2", activePane: "bottomLeft" };
    XLSX.utils.book_append_sheet(wb, bedSheet, "Per Bed Detail");
  }

  // ── DOWNLOAD ──────────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  const hospitalSlug = hospitalFilter && hospitalFilter !== "All"
    ? "_" + hospitalFilter.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_")
    : "";
  XLSX.writeFile(wb, `CareTrack_Report${hospitalSlug}_${dateStr}.xlsx`);
}

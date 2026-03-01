import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = {
  primary:   [79, 110, 119],
  secondary: [103, 128, 147],
  accent:    [124, 83, 102],
  ink:       [42, 38, 36],
  inkLight:  [124, 114, 112],
  light:     [222, 218, 217],
  bg:        [245, 243, 241],
  white:     [255, 255, 255],
  green:     [58, 125, 92],
  amber:     [138, 106, 42],
  red:       [158, 58, 58],
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

const pct = (n, d) => {
  const nv = parseFloat(n), dv = parseFloat(d);
  if (!dv || isNaN(nv) || isNaN(dv)) return null;
  return Math.round((nv / dv) * 100);
};

const pctColor = (v) => {
  if (v === null) return BRAND.inkLight;
  if (v >= 90) return BRAND.green;
  if (v >= 70) return BRAND.amber;
  return BRAND.red;
};

const addHeader = (doc, pageNum, totalPages, preparedBy = "") => {
  // Top bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, 210, 14, "F");
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, 0, 4, 14, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("HOVERTECH", 10, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("an Etac Company", 10, 12);
  doc.setFontSize(7);
  doc.text("CARETRACK · WOUND CARE COMPLIANCE", 80, 9, { align: "center" });

  // Page number
  doc.setFontSize(7);
  doc.text(`Page ${pageNum} of ${totalPages}`, 200, 9, { align: "right" });

  // Footer
  doc.setFillColor(...BRAND.light);
  doc.rect(0, 284, 210, 13, "F");
  doc.setTextColor(...BRAND.inkLight);
  doc.setFontSize(7);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Generated ${today} · HoverTech CareTrack${preparedBy ? ` · Prepared by ${preparedBy}` : ""}`, 105, 291, { align: "center" });
};

export async function generatePdf(entries, summary = "", returnBase64 = false, hospitalFilter = "", preparedBy = "") {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const avgMetrics = METRICS.map(m => {
    const vals = entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return { ...m, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  }).sort((a, b) => {
    const rank = (v) => v === null ? 3 : v >= 90 ? 0 : v >= 70 ? 1 : 2;
    return rank(a.avg) - rank(b.avg);
  });

  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Count pages for pagination
  let totalPages = 3; // title + summary + history
  if (hospitals.length > 1) totalPages++;
  if (summary && summary.length > 10) totalPages++;

  // ── PAGE 1: TITLE ─────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, 0, 8, 297, "F");
  doc.setFillColor(65, 96, 105);
  doc.rect(202, 0, 8, 297, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("Wound Care", 20, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(32);
  doc.setTextColor(222, 218, 217);
  doc.text("Compliance Report", 20, 128);

  doc.setFillColor(124, 168, 180);
  doc.rect(20, 138, 60, 0.8, "F");

  doc.setTextColor(168, 200, 208);
  doc.setFontSize(11);
  doc.text(`Generated ${today}`, 20, 148);
  doc.text(`${entries.length} units audited`, 20, 156);
  doc.text(hospitals.length > 0 ? hospitals.join("  ·  ") : "All Hospitals", 20, 164);
  if (preparedBy) { doc.text(`Prepared by ${preparedBy}`, 20, 172); }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.white);
  doc.text("HOVERTECH", 105, 220, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(168, 200, 208);
  doc.text("an Etac Company", 105, 230, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(124, 168, 180);
  doc.text("CARETRACK", 105, 270, { align: "center" });

  // ── PAGE 2: COMPLIANCE SUMMARY ────────────────────────────────────────────
  doc.addPage();
  addHeader(doc, 2, totalPages, preparedBy);

  doc.setFillColor(...BRAND.bg);
  doc.rect(0, 14, 210, 283, "F");

  doc.setTextColor(...BRAND.primary);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("COMPLIANCE SUMMARY", 14, 24);

  doc.setTextColor(...BRAND.ink);
  doc.setFontSize(20);
  doc.text("Average Compliance by Metric", 14, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.inkLight);
  doc.text(`Across all ${entries.length} logged sessions`, 14, 42);

  // Icon drawing helper — renders icons as SVG data URIs (reliable cross-browser)
  const ICON_SVGS = {
    matt_applied: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="10" rx="2.5" stroke="${col}" stroke-width="1.6"/><line x1="8" y1="7" x2="8" y2="17" stroke="${col}" stroke-width="1" stroke-opacity="0.4"/><line x1="16" y1="7" x2="16" y2="17" stroke="${col}" stroke-width="1" stroke-opacity="0.4"/><line x1="2" y1="12" x2="22" y2="12" stroke="${col}" stroke-width="1" stroke-opacity="0.4"/><circle cx="18.5" cy="6.5" r="4" fill="${col}"/><polyline points="16.2,6.5 18,8.2 21,5" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    wedges_applied: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M2 19 L7 10 L12 19 Z" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 19 L17 10 L22 19 Z" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><line x1="2" y1="19" x2="22" y2="19" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><circle cx="19" cy="7" r="4" fill="${col}"/><polyline points="16.8,7 18.5,8.8 21.5,5.2" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    turning_criteria: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="8.5" stroke="${col}" stroke-width="1.5"/><line x1="12" y1="10" x2="12" y2="5.5" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><line x1="12" y1="10" x2="15.5" y2="12" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="10" r="1" fill="${col}"/><circle cx="12" cy="17" r="3" fill="white" stroke="${col}" stroke-width="1.4"/><path d="M7 24 Q7 21 12 21 Q17 21 17 24" stroke="${col}" stroke-width="1.5" stroke-linecap="round" fill="white"/><line x1="8.5" y1="20.2" x2="15.5" y2="20.2" stroke="white" stroke-width="1.5"/></svg>`,
    matt_proper: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="1" y="5" width="17" height="14" rx="2" stroke="${col}" stroke-width="1.4"/><line x1="9.5" y1="9" x2="9.5" y2="15" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/><line x1="6.5" y1="12" x2="12.5" y2="12" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/><polyline points="8.2,10.2 9.5,9 10.8,10.2" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8.2,13.8 9.5,15 10.8,13.8" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="7.8,10.7 6.5,12 7.8,13.3" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="11.2,10.7 12.5,12 11.2,13.3" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 2 L23 4 L23 8 Q23 11.5 19 13 Q15 11.5 15 8 L15 4 Z" stroke="${col}" stroke-width="1.3" fill="white" stroke-linejoin="round"/><polyline points="17.2,7.5 18.8,9.2 21.2,5.8" stroke="${col}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    wedges_in_room: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M12 2 C8.5 2 6 4.8 6 8 C6 12.5 12 20 12 20 C12 20 18 12.5 18 8 C18 4.8 15.5 2 12 2 Z" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 10 L12 5.5 L15.5 10 Z" stroke="${col}" stroke-width="1.2" stroke-linejoin="round" fill="${col}"/><line x1="8.5" y1="10" x2="15.5" y2="10" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    wedge_offload: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="3.5" cy="5" r="2.2" stroke="${col}" stroke-width="1.3"/><rect x="7" y="3" width="14" height="4" rx="2" stroke="${col}" stroke-width="1.3"/><path d="M18.5 5 Q17 3.6 15.5 5 Q17 6.4 18.5 5" stroke="${col}" stroke-width="0.9" stroke-linecap="round"/><path d="M1 15 L1 17 L8 17 L8 13 Z" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 16.5 L10 14 M11.2 16.5 L11.2 13.5 M12.4 16.5 L12.4 14 M13.6 16.5 L13.6 14.5" stroke="${col}" stroke-width="0.9" stroke-linecap="round"/><path d="M10 16.5 Q9.5 18 10 18.5 L13.6 18.5 Q14.2 18 13.6 16.5" stroke="${col}" stroke-width="1" stroke-linejoin="round"/><path d="M15 13 L15 17 L22 17 L22 15 Z" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    air_supply: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M3 20 L3 4 L21 4 L21 20" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/><line x1="2" y1="20" x2="22" y2="20" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/><path d="M6 10 Q8.5 7.5 11 10 Q13.5 12.5 16 10 Q18.5 7.5 20 10" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/><path d="M6 15 Q8.5 12.5 11 15 Q13.5 17.5 16 15 Q18.5 12.5 20 15" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/><circle cx="19" cy="4" r="4" fill="${col}"/><polyline points="16.8,4 18.5,5.8 21.5,2.2" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  const drawMetricIcon = (doc, id, cx, cy, sizeMm, colorArr) => {
    try {
      const hex = "#" + colorArr.map(v => v.toString(16).padStart(2, "0")).join("");
      const svg = ICON_SVGS[id] ? ICON_SVGS[id](hex) : null;
      if (!svg) return;
      const dataUri = "data:image/svg+xml;base64," + btoa(svg);
      doc.addImage(dataUri, "SVG", cx - sizeMm / 2, cy - sizeMm / 2, sizeMm, sizeMm);
    } catch (e) { /* silently skip icon if rendering fails */ }
  };

  // Metric cards — 2 rows of 4 + 3
  const cardW = 44, cardH = 44, startY = 48, gap = 2;
  avgMetrics.forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = 14 + col * (cardW + gap);
    const cy = startY + row * (cardH + gap + 2);
    const color = pctColor(m.avg);

    doc.setFillColor(...BRAND.white);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");
    doc.setFillColor(...color);
    doc.rect(cx, cy, cardW, 2, "F");

    // Icon
    drawMetricIcon(doc, m.id, cx + cardW / 2, cy + 10, 10, color);

    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(m.label, cardW - 4);
    doc.text(lines, cx + cardW / 2, cy + 18, { align: "center" });

    doc.setTextColor(...color);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(m.avg !== null ? `${m.avg}%` : "—", cx + cardW / 2, cy + 29, { align: "center" });

    // Progress bar
    doc.setFillColor(...BRAND.light);
    doc.rect(cx + 4, cy + 33, cardW - 8, 3, "F");
    if (m.avg !== null) {
      doc.setFillColor(...color);
      doc.rect(cx + 4, cy + 33, Math.max(1, ((cardW - 8) * m.avg) / 100), 3, "F");
    }

    const status = m.avg === null ? "N/A" : m.avg >= 90 ? "ON TARGET" : m.avg >= 70 ? "MONITOR" : "NEEDS ATTENTION";
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(status, cx + cardW / 2, cy + 41, { align: "center" });
  });

  // Legend
  const legendY = 210;
  [[BRAND.green, "≥ 90% — On Target"], [BRAND.amber, "70–89% — Monitor"], [BRAND.red, "< 70% — Needs Attention"]].forEach(([color, label], i) => {
    doc.setFillColor(...color);
    doc.rect(14 + i * 64, legendY, 4, 4, "F");
    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, 22 + i * 64, legendY + 3.5);
  });

  // ── PAGE 3: SESSION HISTORY TABLE ─────────────────────────────────────────
  doc.addPage();
  addHeader(doc, 3, totalPages, preparedBy);

  doc.setFillColor(...BRAND.bg);
  doc.rect(0, 14, 210, 283, "F");

  doc.setTextColor(...BRAND.primary);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("SESSION HISTORY", 14, 24);

  doc.setTextColor(...BRAND.ink);
  doc.setFontSize(20);
  doc.text("Session Log", 14, 35);

  const recentSessions = [...entries].reverse().slice(0, 20);
  const tableRows = recentSessions.map(e => [
    e.created_at ? new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : e.date,
    e.hospital || "—",
    e.location || "—",
    METRICS.slice(0, 4).map(m => { const p = pct(e[`${m.id}_num`], e[`${m.id}_den`]); return p !== null ? `${p}%` : "—"; }).join(" / "),
    METRICS.slice(4).map(m => { const p = pct(e[`${m.id}_num`], e[`${m.id}_den`]); return p !== null ? `${p}%` : "—"; }).join(" / "),
    e.logged_by || "—",
    e.notes || "",
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Timestamp", "Hospital", "Location", "Matt/Wedges/Turn/Prop", "Rm/Off/Air", "Logged By", "Notes"]],
    body: tableRows,
    styles: { fontSize: 7.5, cellPadding: 2, font: "helvetica" },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [240, 237, 234] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 28 }, 2: { cellWidth: 22 }, 3: { cellWidth: 38 }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 }, 6: { cellWidth: 22 } },
    margin: { left: 14, right: 14 },
    theme: "plain",
  });

  if (entries.length > 20) {
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.inkLight);
    doc.setFont("helvetica", "italic");
    doc.text(`Showing most recent 20 of ${entries.length} sessions`, 14, doc.lastAutoTable.finalY + 5);
  }

  // ── PAGE 4: HOSPITAL COMPARISON (if multiple) ─────────────────────────────
  let pageNum = 4;
  if (hospitals.length > 1) {
    doc.addPage();
    addHeader(doc, pageNum, totalPages, preparedBy);
    pageNum++;

    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");

    doc.setTextColor(...BRAND.primary);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("HOSPITAL COMPARISON", 14, 24);

    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Performance by Hospital", 14, 35);

    const hospitalData = hospitals.map(h => {
      const hEntries = entries.filter(e => e.hospital === h);
      return {
        hospital: h,
        sessions: hEntries.length,
        metrics: METRICS.map(m => {
          const vals = hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
          return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        }),
        overall: (() => {
          const vals = METRICS.flatMap(m => hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
          return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        })()
      };
    });

    // Hospital summary cards
    const hCardW = (182 / hospitals.length) - 2;
    hospitalData.forEach((h, i) => {
      const cx = 14 + i * (hCardW + 2);
      const color = pctColor(h.overall);
      doc.setFillColor(...BRAND.white);
      doc.roundedRect(cx, 42, hCardW, 30, 2, 2, "F");
      doc.setFillColor(...color);
      doc.rect(cx, 42, hCardW, 2, "F");
      doc.setTextColor(...BRAND.inkLight);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const hLines = doc.splitTextToSize(h.hospital, hCardW - 4);
      doc.text(hLines, cx + hCardW / 2, cx + 52, { align: "center" });
      doc.text(hLines, cx + hCardW / 2, 52, { align: "center" });
      doc.setTextColor(...color);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(h.overall !== null ? `${h.overall}%` : "—", cx + hCardW / 2, 62, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.inkLight);
      doc.text(`${h.sessions} session${h.sessions !== 1 ? "s" : ""}`, cx + hCardW / 2, 69, { align: "center" });
    });

    // Detailed comparison table
    const compRows = METRICS.map(m => [
      m.label,
      ...hospitalData.map(h => h.metrics[METRICS.indexOf(m)] !== null ? `${h.metrics[METRICS.indexOf(m)]}%` : "—")
    ]);

    autoTable(doc, {
      startY: 80,
      head: [["Metric", ...hospitalData.map(h => h.hospital)]],
      body: compRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 237, 234] },
      margin: { left: 14, right: 14 },
      theme: "plain",
    });
  }

  // ── PAGE: AI SUMMARY ──────────────────────────────────────────────────────
  if (summary && summary.length > 10) {
    doc.addPage();
    addHeader(doc, pageNum, totalPages, preparedBy);

    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");

    doc.setTextColor(...BRAND.primary);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("AI CLINICAL ANALYSIS", 14, 24);

    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Clinical Insights", 14, 35);

    // Summary card
    doc.setFillColor(...BRAND.white);
    doc.roundedRect(14, 42, 182, 220, 3, 3, "F");
    doc.setFillColor(...BRAND.primary);
    doc.rect(14, 42, 4, 220, "F");

    doc.setTextColor(...BRAND.primary);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("✦  AI CLINICAL ANALYSIS", 22, 52);

    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(summary.slice(0, 1200), 168);
    doc.text(summaryLines, 22, 62);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...BRAND.inkLight);
    doc.text("Generated by Claude AI · HoverTech CareTrack", 196, 270, { align: "right" });
  }

  if (returnBase64) {
    return doc.output("datauristring").split(",")[1];
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const hospitalSlug = hospitalFilter && hospitalFilter !== "All" ? "_" + hospitalFilter.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_") : "";
  doc.save(`CareTrack_Report${hospitalSlug}_${dateStr}.pdf`);
}

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
  doc.setFillColor(...brandHeader);
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

export async function generatePdf(entries, summary = "", returnBase64 = false, hospitalFilter = "", preparedBy = "", branding = null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Apply branding accent colour if provided
  const brandAccent = branding?.accentColor
    ? branding.accentColor.replace("#","").match(/.{2}/g).map(v => parseInt(v,16))
    : BRAND.primary;
  const brandHeader = branding?.accentColor ? brandAccent : BRAND.primary;

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
  doc.setFillColor(...brandHeader);
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

  doc.setTextColor(...brandHeader);
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

  // Draw icons using jsPDF primitives only (no canvas, no SVG import)
  const drawIcon = (id, cx, cy, sz, rgb) => {
    const s = sz / 24;
    const x = (v) => cx - sz / 2 + v * s;
    const y = (v) => cy - sz / 2 + v * s;
    const sc = (v) => v * s;
    doc.setDrawColor(...rgb);
    doc.setFillColor(...rgb);

    if (id === "matt_applied") {
      doc.setLineWidth(sc(1.6)); doc.roundedRect(x(2), y(7), sc(20), sc(10), sc(2), sc(2), "S");
      doc.setLineWidth(sc(0.8));
      doc.line(x(8), y(7), x(8), y(17));
      doc.line(x(16), y(7), x(16), y(17));
      doc.line(x(2), y(12), x(22), y(12));
      doc.setLineWidth(0); doc.circle(x(18.5), y(6.5), sc(3.5), "F");
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      doc.line(x(16.5), y(6.5), x(18), y(8)); doc.line(x(18), y(8), x(20.5), y(5.2));

    } else if (id === "wedges_applied") {
      doc.setLineWidth(sc(1.4));
      doc.line(x(2), y(19), x(7), y(10)); doc.line(x(7), y(10), x(12), y(19)); doc.line(x(2), y(19), x(12), y(19));
      doc.line(x(12), y(19), x(17), y(10)); doc.line(x(17), y(10), x(22), y(19)); doc.line(x(12), y(19), x(22), y(19));
      doc.setLineWidth(0); doc.circle(x(19), y(7), sc(3.5), "F");
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      doc.line(x(17), y(7), x(18.5), y(8.8)); doc.line(x(18.5), y(8.8), x(21), y(5.2));

    } else if (id === "turning_criteria") {
      doc.setLineWidth(sc(1.5)); doc.circle(x(12), y(10), sc(8), "S");
      doc.setLineWidth(sc(1.4));
      doc.line(x(12), y(10), x(12), y(5.5));
      doc.line(x(12), y(10), x(15.5), y(12));
      doc.setLineWidth(0); doc.circle(x(12), y(10), sc(1), "F");
      doc.setFillColor(...BRAND.white); doc.setLineWidth(sc(1.4));
      doc.circle(x(12), y(17), sc(3), "FD");
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.5));
      doc.line(x(8.5), y(20.5), x(15.5), y(20.5));

    } else if (id === "matt_proper") {
      doc.setLineWidth(sc(1.4)); doc.roundedRect(x(1), y(5), sc(17), sc(14), sc(1.5), sc(1.5), "S");
      doc.setLineWidth(sc(1.2));
      doc.line(x(9.5), y(9), x(9.5), y(15));
      doc.line(x(6.5), y(12), x(12.5), y(12));
      doc.setLineWidth(sc(1.1));
      doc.line(x(8.2), y(10.2), x(9.5), y(9)); doc.line(x(9.5), y(9), x(10.8), y(10.2));
      doc.line(x(8.2), y(13.8), x(9.5), y(15)); doc.line(x(9.5), y(15), x(10.8), y(13.8));
      doc.line(x(7.8), y(10.7), x(6.5), y(12)); doc.line(x(6.5), y(12), x(7.8), y(13.3));
      doc.line(x(11.2), y(10.7), x(12.5), y(12)); doc.line(x(12.5), y(12), x(11.2), y(13.3));
      doc.setFillColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      doc.line(x(15), y(4), x(23), y(4)); doc.line(x(23), y(4), x(19), y(13)); doc.line(x(19), y(13), x(15), y(4));
      doc.setDrawColor(...rgb); doc.setLineWidth(sc(1.3));
      doc.line(x(17.2), y(7.5), x(18.8), y(9.2)); doc.line(x(18.8), y(9.2), x(21.2), y(5.8));

    } else if (id === "wedges_in_room") {
      doc.setLineWidth(sc(1.4));
      doc.line(x(12), y(2), x(6), y(8)); doc.line(x(6), y(8), x(6), y(12));
      doc.line(x(6), y(12), x(12), y(20)); doc.line(x(12), y(20), x(18), y(12));
      doc.line(x(18), y(12), x(18), y(8)); doc.line(x(18), y(8), x(12), y(2));
      doc.setLineWidth(0); doc.setFillColor(...rgb);
      doc.line(x(8.5), y(10), x(12), y(5.5)); doc.line(x(12), y(5.5), x(15.5), y(10)); doc.line(x(15.5), y(10), x(8.5), y(10));
      doc.setDrawColor(...rgb); doc.setLineWidth(sc(1.2));
      doc.line(x(8.5), y(10), x(15.5), y(10));

    } else if (id === "wedge_offload") {
      doc.setLineWidth(sc(1.3)); doc.circle(x(3.5), y(5), sc(2.2), "S");
      doc.roundedRect(x(7), y(3), sc(14), sc(4), sc(1.5), sc(1.5), "S");
      doc.line(x(1), y(13), x(1), y(17)); doc.line(x(1), y(17), x(8), y(17));
      doc.line(x(8), y(17), x(8), y(13)); doc.line(x(8), y(13), x(1), y(13));
      doc.setLineWidth(sc(0.9));
      doc.line(x(10), y(14), x(10), y(16.5));
      doc.line(x(11.5), y(13.5), x(11.5), y(16.5));
      doc.line(x(13), y(14), x(13), y(16.5));
      doc.setLineWidth(sc(1.3));
      doc.line(x(15), y(13), x(15), y(17)); doc.line(x(15), y(17), x(22), y(17));
      doc.line(x(22), y(17), x(22), y(15)); doc.line(x(22), y(15), x(15), y(13));

    } else if (id === "air_supply") {
      doc.setLineWidth(sc(1.6));
      doc.line(x(3), y(20), x(3), y(4));
      doc.line(x(3), y(4), x(21), y(4));
      doc.line(x(21), y(4), x(21), y(20));
      doc.line(x(2), y(20), x(22), y(20));
      doc.setLineWidth(sc(1.5));
      doc.line(x(6), y(10), x(8.5), y(7.5)); doc.line(x(8.5), y(7.5), x(11), y(10));
      doc.line(x(11), y(10), x(13.5), y(12.5)); doc.line(x(13.5), y(12.5), x(16), y(10));
      doc.line(x(16), y(10), x(18.5), y(7.5)); doc.line(x(18.5), y(7.5), x(20), y(10));
      doc.line(x(6), y(15), x(8.5), y(12.5)); doc.line(x(8.5), y(12.5), x(11), y(15));
      doc.line(x(11), y(15), x(13.5), y(17.5)); doc.line(x(13.5), y(17.5), x(16), y(15));
      doc.line(x(16), y(15), x(18.5), y(12.5)); doc.line(x(18.5), y(12.5), x(20), y(15));
      doc.setLineWidth(0); doc.setFillColor(...rgb); doc.circle(x(19), y(4), sc(3.5), "F");
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      doc.line(x(17), y(4), x(18.5), y(5.8)); doc.line(x(18.5), y(5.8), x(21), y(2.2));
    }
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
    drawIcon(m.id, cx + cardW / 2, cy + 12, 10, color);

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
  [[BRAND.green, "90%+ — On Target"], [BRAND.amber, "70-89% — Monitor"], [BRAND.red, "< 70% — Needs Attention"]].forEach(([color, label], i) => {
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

  doc.setTextColor(...brandHeader);
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
    headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 7.5 },
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

    doc.setTextColor(...brandHeader);
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
      headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold" },
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

    doc.setTextColor(...brandHeader);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("AI CLINICAL ANALYSIS", 14, 24);

    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Clinical Insights", 14, 35);

    // Summary card
    doc.setFillColor(...BRAND.white);
    doc.roundedRect(14, 42, 182, 220, 3, 3, "F");
    doc.setFillColor(...brandHeader);
    doc.rect(14, 42, 4, 220, "F");

    doc.setTextColor(...brandHeader);
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

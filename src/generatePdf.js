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

// Metric definitions in display order, with bucket grouping
const METRICS = [
  { id: "turning_criteria", label: "Turning & Repositioning", bucket: "Patient Met Criteria" },
  { id: "matt_applied",     label: "Matt Applied",            bucket: "Matt Compliance" },
  { id: "matt_proper",      label: "Matt Applied Properly",   bucket: "Matt Compliance" },
  { id: "wedges_in_room",   label: "Wedges in Room",          bucket: "Wedge Compliance" },
  { id: "wedges_applied",   label: "Wedges Applied",          bucket: "Wedge Compliance" },
  { id: "wedge_offload",    label: "Proper Wedge Offloading", bucket: "Wedge Compliance" },
  { id: "air_supply",       label: "Air Supply in Room",      bucket: "Air Supply" },
];
const MAYO_METRICS = [{ id: "air_reposition", label: "Air Used to Reposition Patient", bucket: "Air Supply" }];
const KAISER_METRICS = [{ id: "heel_boots", label: "Heel Boots" }, { id: "turn_clock", label: "Turn Clock" }];
const BUCKETS = ["Patient Met Criteria", "Matt Compliance", "Wedge Compliance", "Air Supply"];

const isMayo = (hospital) => hospital && hospital.toLowerCase().includes("mayo");
const isKaiser = (hospital) => hospital && hospital.toLowerCase().includes("kaiser");
const getMetrics = (hospital) => isMayo(hospital) ? [...METRICS, ...MAYO_METRICS] : METRICS;

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

const addHeader = (doc, pageNum, totalPages, preparedBy = "", headerColor = BRAND.primary) => {
  doc.setFillColor(...headerColor);
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
  doc.text("CARETRACK · WOUND CARE COMPLIANCE", 80, 9, { align: "center" });
  doc.text(`Page ${pageNum} of ${totalPages}`, 200, 9, { align: "right" });
  doc.setFillColor(...BRAND.light);
  doc.rect(0, 284, 210, 13, "F");
  doc.setTextColor(...BRAND.inkLight);
  doc.setFontSize(7);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Generated ${today} · HoverTech CareTrack${preparedBy ? ` · Prepared by ${preparedBy}` : ""}`, 105, 291, { align: "center" });
};

const drawIcon = (doc, id, cx, cy, sz, rgb) => {
  const s = sz / 24;
  const x = (v) => cx - sz / 2 + v * s;
  const y = (v) => cy - sz / 2 + v * s;
  const sc = (v) => v * s;
  doc.setDrawColor(...rgb);
  doc.setFillColor(...rgb);

  if (id === "matt_applied") {
    doc.setLineWidth(sc(1.6)); doc.roundedRect(x(2), y(7), sc(20), sc(10), sc(2), sc(2), "S");
    doc.setLineWidth(sc(0.8));
    doc.line(x(8), y(7), x(8), y(17)); doc.line(x(16), y(7), x(16), y(17)); doc.line(x(2), y(12), x(22), y(12));
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
    doc.line(x(12), y(10), x(12), y(5.5)); doc.line(x(12), y(10), x(15.5), y(12));
    doc.setLineWidth(0); doc.circle(x(12), y(10), sc(1), "F");
    doc.setFillColor(...BRAND.white); doc.setLineWidth(sc(1.4));
    doc.circle(x(12), y(17), sc(3), "FD");
    doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.5));
    doc.line(x(8.5), y(20.5), x(15.5), y(20.5));

  } else if (id === "matt_proper") {
    doc.setLineWidth(sc(1.4)); doc.roundedRect(x(1), y(5), sc(17), sc(14), sc(1.5), sc(1.5), "S");
    doc.setLineWidth(sc(1.2));
    doc.line(x(9.5), y(9), x(9.5), y(15)); doc.line(x(6.5), y(12), x(12.5), y(12));
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
    doc.line(x(10), y(14), x(10), y(16.5)); doc.line(x(11.5), y(13.5), x(11.5), y(16.5)); doc.line(x(13), y(14), x(13), y(16.5));
    doc.setLineWidth(sc(1.3));
    doc.line(x(15), y(13), x(15), y(17)); doc.line(x(15), y(17), x(22), y(17));
    doc.line(x(22), y(17), x(22), y(15)); doc.line(x(22), y(15), x(15), y(13));

  } else if (id === "air_supply") {
    doc.setLineWidth(sc(1.6));
    doc.line(x(3), y(20), x(3), y(4)); doc.line(x(3), y(4), x(21), y(4));
    doc.line(x(21), y(4), x(21), y(20)); doc.line(x(2), y(20), x(22), y(20));
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

  } else if (id === "air_reposition") {
    doc.setLineWidth(sc(1.5));
    doc.circle(x(12), y(12), sc(9), "S");
    doc.setLineWidth(sc(1.4));
    doc.line(x(12), y(6), x(12), y(12)); doc.line(x(12), y(12), x(16), y(10));
    doc.setLineWidth(sc(1.3));
    doc.line(x(6), y(18), x(12), y(21)); doc.line(x(12), y(21), x(18), y(18));
    doc.setLineWidth(0); doc.circle(x(12), y(12), sc(1), "F");
  }
};

export async function generatePdf(entries, summary = "", returnBase64 = false, hospitalFilter = "", preparedBy = "", branding = null, chartData = [], mom = null, allEntries = []) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const brandAccent = branding?.accentColor
    ? branding.accentColor.replace("#", "").match(/.{2}/g).map(v => parseInt(v, 16))
    : BRAND.primary;
  const brandHeader = branding?.accentColor ? brandAccent : BRAND.primary;

  const hasMayo = entries.some(e => isMayo(e.hospital));
  const hasKaiser = entries.some(e => isKaiser(e.hospital));
  const summaryMetrics = hasMayo ? [...METRICS, ...MAYO_METRICS] : METRICS;
  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const hasBedData = entries.some(e => e.bed_data && e.bed_data.length > 0);

  // National averages from allEntries (full org dataset)
  const nationalAvg = {};
  summaryMetrics.forEach(m => {
    const vals = (allEntries.length ? allEntries : entries)
      .map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    nationalAvg[m.id] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });

  // Per-metric averages in bucket order (no sorting by score)
  const avgMetrics = summaryMetrics.map(m => {
    const vals = entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const nat = nationalAvg[m.id];
    const diff = avg !== null && nat !== null ? avg - nat : null;
    return { ...m, avg, nat, diff };
  });

  // Page count
  let totalPages = 3; // title + summary + history
  if (mom?.hasData) totalPages++;
  if (hospitals.length > 1) totalPages++;
  if (hasBedData) totalPages++;
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
  if (preparedBy) doc.text(`Prepared by ${preparedBy}`, 20, 172);
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
  addHeader(doc, 2, totalPages, preparedBy, brandHeader);
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

  // Metric cards — full-width horizontal cards, grouped by bucket
  const pageW = 182; // usable width (14mm margins each side)
  const cardLeft = 14;
  let curY = 50;

  // Draw one full-width horizontal metric card
  const drawMetricCard = (m, cy) => {
    const cardH = 28;
    const color = pctColor(m.avg);

    // Card background
    doc.setFillColor(...BRAND.white);
    doc.roundedRect(cardLeft, cy, pageW, cardH, 2, 2, "F");

    // Top colour bar
    doc.setFillColor(...color);
    doc.rect(cardLeft, cy, pageW, 2, "F");

    // Metric label — top left
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.inkLight);
    doc.text(m.label, cardLeft + 4, cy + 8);

    // Icon — top right
    drawIcon(doc, m.id, cardLeft + pageW - 10, cy + 9, 10, color);

    // Large % — bottom left
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(m.avg !== null ? `${m.avg}%` : "—", cardLeft + 4, cy + 22);

    // Progress bar — full width, bottom section
    const barX = cardLeft + 4;
    const barY = cy + 24;
    const barW = pageW - 8;
    const barH = 2.5;
    doc.setFillColor(...BRAND.light);
    doc.rect(barX, barY, barW, barH, "F");
    if (m.avg !== null) {
      doc.setFillColor(...color);
      doc.rect(barX, barY, Math.max(1, (barW * m.avg) / 100), barH, "F");
    }

    // National avg tick mark on bar
    if (m.nat !== null) {
      const tickX = barX + (barW * m.nat) / 100;
      doc.setFillColor(...BRAND.inkLight);
      doc.rect(tickX - 0.4, barY - 0.5, 0.8, barH + 1, "F");
    }

    // National avg label — bottom left below bar
    if (m.nat !== null) {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.inkLight);
      doc.text(`National avg: ${m.nat}%`, cardLeft + 4, cy + cardH - 0.5);
    }

    // Delta — bottom right
    if (m.diff !== null) {
      const diffStr = m.diff > 0 ? `+${m.diff}%` : `${m.diff}%`;
      const diffColor = m.diff >= 0 ? BRAND.green : BRAND.red;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...diffColor);
      doc.text(diffStr, cardLeft + pageW - 4, cy + cardH - 0.5, { align: "right" });
    }

    return cardH;
  };

  BUCKETS.forEach(bucketLabel => {
    const bucketMetrics = avgMetrics.filter(m => m.bucket === bucketLabel);
    if (!bucketMetrics.length) return;

    // Check if we need a new page
    const needed = 6 + bucketMetrics.length * 32;
    if (curY + needed > 275) {
      doc.addPage();
      addHeader(doc, 2, totalPages, preparedBy, brandHeader);
      doc.setFillColor(...BRAND.bg);
      doc.rect(0, 14, 210, 283, "F");
      curY = 20;
    }

    // Bucket label
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.inkLight);
    doc.text(bucketLabel.toUpperCase(), cardLeft, curY + 4);
    curY += 8;

    bucketMetrics.forEach(m => {
      drawMetricCard(m, curY);
      curY += 32;
    });
  });

  // Kaiser-specific extra section
  if (hasKaiser) {
    if (curY + 44 > 275) {
      doc.addPage();
      addHeader(doc, 2, totalPages, preparedBy, brandHeader);
      doc.setFillColor(...BRAND.bg);
      doc.rect(0, 14, 210, 283, "F");
      curY = 20;
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.inkLight);
    doc.text("KAISER PERMANENTE", cardLeft, curY + 4);
    curY += 8;

    const kCardW = (pageW / 2) - 2;
    KAISER_METRICS.forEach((km, i) => {
      const cx = cardLeft + i * (kCardW + 4);
      const cardH = 28;
      doc.setFillColor(...BRAND.white);
      doc.roundedRect(cx, curY, kCardW, cardH, 2, 2, "F");
      doc.setFillColor(...BRAND.light);
      doc.rect(cx, curY, kCardW, 2, "F");
      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.inkLight);
      doc.text(km.label, cx + 4, curY + 8);
      // Icon
      drawIcon(doc, km.id === "heel_boots" ? "matt_applied" : "turning_criteria", cx + kCardW - 10, curY + 9, 10, BRAND.inkLight);
      // Check for actual data
      const heelVals = km.id === "heel_boots"
        ? entries.map(e => pct(e.heel_boots_num, e.heel_boots_den)).filter(v => v !== null)
        : entries.map(e => pct(e.turn_clock_num, e.turn_clock_den)).filter(v => v !== null);
      const heelAvg = heelVals.length ? Math.round(heelVals.reduce((a, b) => a + b, 0) / heelVals.length) : null;
      const kColor = heelAvg !== null ? pctColor(heelAvg) : BRAND.inkLight;
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...kColor);
      doc.text(heelAvg !== null ? `${heelAvg}%` : "—", cx + 4, curY + 22);
      if (heelAvg !== null) {
        const barX = cx + 4, barY = curY + 24, barW = kCardW - 8;
        doc.setFillColor(...BRAND.light);
        doc.rect(barX, barY, barW, 2.5, "F");
        doc.setFillColor(...kColor);
        doc.rect(barX, barY, Math.max(1, (barW * heelAvg) / 100), 2.5, "F");
      }
    });
    curY += 32;
  }

  // Legend
  [[BRAND.green, "90%+ — On Target"], [BRAND.amber, "70-89% — Monitor"], [BRAND.red, "< 70% — Needs Attention"]].forEach(([color, label], i) => {
    doc.setFillColor(...color);
    doc.rect(14 + i * 66, curY + 4, 4, 4, "F");
    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, 22 + i * 66, curY + 7.5);
  });

  // ── PAGE: MONTH-OVER-MONTH ────────────────────────────────────────────────
  let pageCounter = 3;
  if (mom?.hasData) {
    doc.addPage();
    addHeader(doc, pageCounter, totalPages, preparedBy, brandHeader);
    pageCounter++;
    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");
    doc.setTextColor(...brandHeader);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("MONTH-OVER-MONTH COMPARISON", 14, 24);
    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Monthly Performance", 14, 35);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.inkLight);
    doc.text(`${mom.lastMonth}  →  ${mom.thisMonth}`, 14, 42);

    const cardDefs = [
      { label: mom.thisMonth, value: mom.thisAvg !== null ? `${mom.thisAvg}%` : "—", sub: `${mom.thisSessions} sessions`, color: mom.thisAvg !== null ? pctColor(mom.thisAvg) : BRAND.inkLight },
      { label: mom.lastMonth, value: mom.lastAvg !== null ? `${mom.lastAvg}%` : "—", sub: `${mom.lastSessions} sessions`, color: mom.lastAvg !== null ? pctColor(mom.lastAvg) : BRAND.inkLight },
      { label: "Change", value: mom.delta !== null ? `${mom.delta > 0 ? "+" : ""}${mom.delta}%` : "—", sub: "vs last month", color: mom.delta === null ? BRAND.inkLight : mom.delta > 0 ? BRAND.green : mom.delta < 0 ? BRAND.red : BRAND.inkLight },
    ];
    cardDefs.forEach((card, i) => {
      const cx = 14 + i * 62;
      doc.setFillColor(...BRAND.white);
      doc.roundedRect(cx, 48, 58, 28, 2, 2, "F");
      doc.setFillColor(...card.color);
      doc.rect(cx, 48, 58, 2, "F");
      doc.setTextColor(...BRAND.inkLight);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, cx + 29, 55, { align: "center" });
      doc.setTextColor(...card.color);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, cx + 29, 67, { align: "center" });
      doc.setTextColor(...BRAND.inkLight);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.sub, cx + 29, 73, { align: "center" });
    });

    const momRows = mom.metricDeltas.map(m => [
      m.label,
      m.last !== null ? `${m.last}%` : "—",
      m.this !== null ? `${m.this}%` : "—",
      m.delta === null ? "—" : m.delta > 0 ? `+${m.delta}%` : `${m.delta}%`,
      m.delta === null ? "—" : m.delta > 0 ? "▲ Improved" : m.delta < 0 ? "▼ Declined" : "→ Unchanged",
    ]);
    autoTable(doc, {
      startY: 84,
      head: [["Metric", mom.lastMonth, mom.thisMonth, "Change", "Trend"]],
      body: momRows,
      styles: { fontSize: 8, cellPadding: 2.5, font: "helvetica" },
      headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 237, 234] },
      columnStyles: {
        0: { cellWidth: 58 }, 1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: 28, halign: "center" }, 3: { cellWidth: 24, halign: "center" }, 4: { cellWidth: 36, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === "body") {
          const val = parseFloat(data.cell.raw);
          if (!isNaN(val)) data.cell.styles.textColor = val > 0 ? BRAND.green : val < 0 ? BRAND.red : BRAND.inkLight;
        }
        if (data.column.index === 4 && data.section === "body") {
          const raw = String(data.cell.raw);
          data.cell.styles.textColor = raw.startsWith("▲") ? BRAND.green : raw.startsWith("▼") ? BRAND.red : BRAND.inkLight;
        }
      },
      margin: { left: 14, right: 14 },
      theme: "plain",
    });
  }

  // ── PAGE: SESSION HISTORY ─────────────────────────────────────────────────
  doc.addPage();
  addHeader(doc, pageCounter, totalPages, preparedBy, brandHeader);
  pageCounter++;
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

  // Build session table columns matching the PDF exactly
  const sessionHead = hasKaiser
    ? [["Date", "Hospital", "Unit", "Matt Compliance", "Wedge Compliance", "Turning", "Air Supply", "Kaiser Metrics", "Logged By", "Notes"]]
    : [["Date", "Hospital", "Unit", "Matt Compliance", "Wedge Compliance", "Turning", "Air Supply", "Logged By", "Notes"]];

  const sessionRows = recentSessions.map(e => {
    const mattCol = [
      pct(e.matt_applied_num, e.matt_applied_den) !== null ? `Applied: ${pct(e.matt_applied_num, e.matt_applied_den)}%` : null,
      pct(e.matt_proper_num, e.matt_proper_den) !== null ? `Properly: ${pct(e.matt_proper_num, e.matt_proper_den)}%` : null,
    ].filter(Boolean).join("\n") || "—";
    const wedgeCol = [
      pct(e.wedges_in_room_num, e.wedges_in_room_den) !== null ? `In Room: ${pct(e.wedges_in_room_num, e.wedges_in_room_den)}%` : null,
      pct(e.wedges_applied_num, e.wedges_applied_den) !== null ? `Applied: ${pct(e.wedges_applied_num, e.wedges_applied_den)}%` : null,
      pct(e.wedge_offload_num, e.wedge_offload_den) !== null ? `Offloading: ${pct(e.wedge_offload_num, e.wedge_offload_den)}%` : null,
    ].filter(Boolean).join("\n") || "—";
    const turnV = pct(e.turning_criteria_num, e.turning_criteria_den);
    const airV = pct(e.air_supply_num, e.air_supply_den);
    const dt = e.created_at
      ? new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : e.date;

    const baseRow = [dt, e.hospital || "—", e.location || "—", mattCol, wedgeCol,
      turnV !== null ? `${turnV}%` : "—", airV !== null ? `${airV}%` : "—"];

    if (hasKaiser) {
      const heelBoots = e.heel_boots_num !== undefined && e.heel_boots_den !== undefined
        ? (pct(e.heel_boots_num, e.heel_boots_den) !== null ? `Heel Boots: ${pct(e.heel_boots_num, e.heel_boots_den)}%` : "Heel Boots: —")
        : "Heel Boots: —";
      const turnClock = e.turn_clock_num !== undefined && e.turn_clock_den !== undefined
        ? (pct(e.turn_clock_num, e.turn_clock_den) !== null ? `Turn Clock: ${pct(e.turn_clock_num, e.turn_clock_den)}%` : "Turn Clock: —")
        : "Turn Clock: —";
      baseRow.push(`${heelBoots}\n${turnClock}`);
    }

    baseRow.push(e.logged_by || "—", e.notes || "");
    return baseRow;
  });

  const colStyles = hasKaiser
    ? { 0: { cellWidth: 18 }, 1: { cellWidth: 22 }, 2: { cellWidth: 16 }, 3: { cellWidth: 28 }, 4: { cellWidth: 28 }, 5: { cellWidth: 12, halign: "center" }, 6: { cellWidth: 12, halign: "center" }, 7: { cellWidth: 22 }, 8: { cellWidth: 18 }, 9: { cellWidth: 18 } }
    : { 0: { cellWidth: 22 }, 1: { cellWidth: 26 }, 2: { cellWidth: 20 }, 3: { cellWidth: 32 }, 4: { cellWidth: 32 }, 5: { cellWidth: 14, halign: "center" }, 6: { cellWidth: 14, halign: "center" }, 7: { cellWidth: 22 }, 8: { cellWidth: 18 } };

  autoTable(doc, {
    startY: 40,
    head: sessionHead,
    body: sessionRows,
    styles: { fontSize: 7, cellPadding: 2, font: "helvetica" },
    headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [240, 237, 234] },
    columnStyles: colStyles,
    margin: { left: 14, right: 14 },
    theme: "plain",
  });

  if (entries.length > 20) {
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.inkLight);
    doc.setFont("helvetica", "italic");
    doc.text(`Showing most recent 20 of ${entries.length} sessions`, 14, doc.lastAutoTable.finalY + 5);
  }

  // ── PAGE: PER BED DETAIL ──────────────────────────────────────────────────
  if (hasBedData) {
    doc.addPage();
    addHeader(doc, pageCounter, totalPages, preparedBy, brandHeader);
    pageCounter++;
    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");
    doc.setTextColor(...brandHeader);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("PER BED DETAIL", 14, 24);
    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Bed-Level Compliance", 14, 35);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.inkLight);
    doc.text("Sessions recorded using Per Bed mode — individual bed data", 14, 42);

    const bedSessions = entries.filter(e => e.bed_data && e.bed_data.length > 0).reverse();
    const allMetrics = hasMayo ? [...METRICS, ...MAYO_METRICS] : METRICS;
    const bedMetricLabels = allMetrics.map(m => m.label.split(" ").slice(0, 2).join(" "));
    const extraCols = hasKaiser ? ["Heel Boots", "Trn Clock"] : [];

    const bedHead = [["Date", "Hospital", "Location", "Bed", "Room", ...bedMetricLabels, ...extraCols]];
    const bedRows = bedSessions.flatMap(e => {
      const dt = e.created_at
        ? new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : e.date;
      return (e.bed_data || []).map(bed => {
        const metricVals = allMetrics.map(m => {
          if (bed.na || bed[`${m.id}_na`]) return "N/A";
          const q = parseInt(bed[`${m.id}_q`]) || 0;
          const a = parseInt(bed[`${m.id}_a`]) || 0;
          if (!q) return "—";
          return `${Math.round((a / q) * 100)}%`;
        });
        const extras = hasKaiser ? ["—", "—"] : [];
        return [dt, e.hospital || "—", e.location || "—", bed.bedNum || bed.bed || "—", bed.room || "—", ...metricVals, ...extras];
      });
    });

    autoTable(doc, {
      startY: 46,
      head: bedHead,
      body: bedRows,
      styles: { fontSize: 6, cellPadding: 1.5, font: "helvetica" },
      headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 6 },
      alternateRowStyles: { fillColor: [240, 237, 234] },
      margin: { left: 6, right: 6 },
      theme: "plain",
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 5) {
          const raw = String(data.cell.raw);
          if (raw.includes("%")) {
            const v = parseInt(raw);
            data.cell.styles.textColor = v >= 90 ? BRAND.green : v >= 70 ? BRAND.amber : BRAND.red;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
  }

  // ── PAGE: HOSPITAL COMPARISON (if multiple) ───────────────────────────────
  if (hospitals.length > 1) {
    doc.addPage();
    addHeader(doc, pageCounter, totalPages, preparedBy, brandHeader);
    pageCounter++;
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
      const hMetrics = getMetrics(h);
      const overall = (() => {
        const vals = hMetrics.flatMap(m => hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      })();
      return { hospital: h, sessions: hEntries.length, overall,
        metrics: summaryMetrics.map(m => {
          if (!hMetrics.find(x => x.id === m.id)) return null;
          const vals = hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
          return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        })
      };
    });

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

    const compRows = summaryMetrics.map(m => [
      m.label, ...hospitalData.map(h => h.metrics[summaryMetrics.indexOf(m)] !== null ? `${h.metrics[summaryMetrics.indexOf(m)]}%` : "—")
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
    addHeader(doc, pageCounter, totalPages, preparedBy, brandHeader);
    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");
    doc.setTextColor(...brandHeader);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("AI CLINICAL ANALYSIS", 14, 24);
    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Clinical Insights", 14, 35);
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
  const hospitalSlug = hospitalFilter && hospitalFilter !== "All"
    ? "_" + hospitalFilter.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_")
    : "";
  doc.save(`CareTrack_Report${hospitalSlug}_${dateStr}.pdf`);
}

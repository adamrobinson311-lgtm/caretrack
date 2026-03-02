import pptxgen from "pptxgenjs";

export async function generatePptx(entries, summary = "", hospitalFilter = "", preparedBy = "", branding = null) {
  // Apply branding accent if provided — convert hex to 6-char string for pptxgenjs
  const brandPrimary = branding?.accentColor ? branding.accentColor.replace("#","") : BRAND.primary;
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "HoverTech CareTrack";
  pres.title = "Wound Care Compliance Report";

  const BRAND = {
    primary:   "4F6E77",
    secondary: "678093",
    accent:    "7C5366",
    mid:       "7C7270",
    light:     "DEDAD9",
    bg:        "F5F3F1",
    white:     "FFFFFF",
    ink:       "2A2624",
    inkLight:  "7C7270",
    green:     "3A7D5C",
    amber:     "8A6A2A",
    red:       "9E3A3A",
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

  const avgMetrics = METRICS.map(m => {
    const vals = entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return { ...m, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  }).sort((a, b) => {
    const rank = (v) => v === null ? 3 : v >= 90 ? 0 : v >= 70 ? 1 : 2;
    return rank(a.avg) - rank(b.avg);
  });

  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const addSectionLabel = (slide, text) => {
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.22, h: 5.625, fill: { color: brandPrimary }, line: { color: brandPrimary } });
    slide.addText(text, { x: 0.38, y: 0.28, w: 9.3, h: 0.35, fontSize: 9, fontFace: "Calibri", color: brandPrimary, charSpacing: 3, bold: true, margin: 0 });
  };

  // ── SLIDE 1: TITLE ────────────────────────────────────────────────────────
  const s1 = pres.addSlide();
  s1.background = { color: brandPrimary };
  s1.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 0, w: 3.2, h: 5.625, fill: { color: "416069" }, line: { color: "416069" } });
  s1.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 0, w: 0.4, h: 5.625, fill: { color: BRAND.accent }, line: { color: BRAND.accent } });
  s1.addText("Wound Care", { x: 0.55, y: 1.3, w: 6.0, h: 0.8, fontSize: 44, fontFace: "Georgia", color: BRAND.white, bold: true, margin: 0 });
  s1.addText("Compliance Report", { x: 0.55, y: 2.05, w: 6.0, h: 0.8, fontSize: 44, fontFace: "Georgia", color: BRAND.light, bold: false, italic: true, margin: 0 });
  s1.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 2.95, w: 2.5, h: 0.04, fill: { color: "7CA8B4" }, line: { color: "7CA8B4" } });
  s1.addText(`Generated ${today}`, { x: 0.55, y: 3.15, w: 6.0, h: 0.3, fontSize: 12, fontFace: "Calibri", color: "A8C8D0", margin: 0 });
  s1.addText(`${entries.length} units audited`, { x: 0.55, y: 3.5, w: 6.0, h: 0.3, fontSize: 12, fontFace: "Calibri", color: "A8C8D0", margin: 0 });
  s1.addText(hospitals.length > 0 ? hospitals.join("  ·  ") : "All Hospitals", { x: 0.55, y: 3.85, w: 6.0, h: 0.3, fontSize: 12, fontFace: "Calibri", color: "A8C8D0", margin: 0 });
  if (preparedBy) s1.addText(`Prepared by ${preparedBy}`, { x: 0.55, y: 4.2, w: 6.0, h: 0.3, fontSize: 12, fontFace: "Calibri", color: "7CA8B4", margin: 0 });
  s1.addText("HOVERTECH", { x: 6.95, y: 1.9, w: 2.5, h: 0.45, fontSize: 20, fontFace: "Georgia", color: BRAND.white, bold: true, align: "center", margin: 0 });
  s1.addText("an Etac Company", { x: 6.95, y: 2.38, w: 2.5, h: 0.28, fontSize: 11, fontFace: "Calibri", color: "A8C8D0", italic: true, align: "center", margin: 0 });
  s1.addText("CARETRACK", { x: 6.95, y: 4.8, w: 2.5, h: 0.3, fontSize: 9, fontFace: "Calibri", color: "7CA8B4", align: "center", charSpacing: 4, margin: 0 });

  // ── SLIDE 2: COMPLIANCE SUMMARY ───────────────────────────────────────────
  const s2 = pres.addSlide();
  s2.background = { color: BRAND.bg };
  addSectionLabel(s2, "COMPLIANCE SUMMARY");
  s2.addText("Average Compliance by Metric", { x: 0.38, y: 0.68, w: 9.3, h: 0.5, fontSize: 24, fontFace: "Georgia", color: BRAND.ink, bold: true, margin: 0 });
  s2.addText(`Across all ${entries.length} logged sessions`, { x: 0.38, y: 1.18, w: 9.3, h: 0.28, fontSize: 12, fontFace: "Calibri", color: BRAND.inkLight, margin: 0 });

  const cardW = 1.26, cardH = 2.8, cardY = 1.62, cardGap = 0.08;

  // SVG icon data URIs for each metric — rendered as images on cards
  const ICON_SVGS = {
    matt_applied: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="10" rx="2.5" stroke="${col}" stroke-width="1.6"/><line x1="8" y1="7" x2="8" y2="17" stroke="${col}" stroke-width="1" stroke-opacity="0.4"/><line x1="16" y1="7" x2="16" y2="17" stroke="${col}" stroke-width="1" stroke-opacity="0.4"/><line x1="2" y1="12" x2="22" y2="12" stroke="${col}" stroke-width="1" stroke-opacity="0.4"/><circle cx="18.5" cy="6.5" r="4" fill="${col}"/><polyline points="16.2,6.5 18,8.2 21,5" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    wedges_applied: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M2 19 L7 10 L12 19 Z" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 19 L17 10 L22 19 Z" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><line x1="2" y1="19" x2="22" y2="19" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><circle cx="19" cy="7" r="4" fill="${col}"/><polyline points="16.8,7 18.5,8.8 21.5,5.2" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    turning_criteria: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="8.5" stroke="${col}" stroke-width="1.5"/><line x1="12" y1="10" x2="12" y2="5.5" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><line x1="12" y1="10" x2="15.5" y2="12" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="10" r="1" fill="${col}"/><circle cx="12" cy="17" r="3" fill="white" stroke="${col}" stroke-width="1.4"/><path d="M7 24 Q7 21 12 21 Q17 21 17 24" stroke="${col}" stroke-width="1.5" stroke-linecap="round" fill="white"/><line x1="8.5" y1="20.2" x2="15.5" y2="20.2" stroke="white" stroke-width="1.5"/></svg>`,
    matt_proper: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="1" y="5" width="17" height="14" rx="2" stroke="${col}" stroke-width="1.4"/><line x1="9.5" y1="9" x2="9.5" y2="15" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/><line x1="6.5" y1="12" x2="12.5" y2="12" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/><polyline points="8.2,10.2 9.5,9 10.8,10.2" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8.2,13.8 9.5,15 10.8,13.8" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="7.8,10.7 6.5,12 7.8,13.3" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="11.2,10.7 12.5,12 11.2,13.3" stroke="${col}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 2 L23 4 L23 8 Q23 11.5 19 13 Q15 11.5 15 8 L15 4 Z" stroke="${col}" stroke-width="1.3" fill="white" stroke-linejoin="round"/><polyline points="17.2,7.5 18.8,9.2 21.2,5.8" stroke="${col}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    wedges_in_room: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M12 2 C8.5 2 6 4.8 6 8 C6 12.5 12 20 12 20 C12 20 18 12.5 18 8 C18 4.8 15.5 2 12 2 Z" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 10 L12 5.5 L15.5 10 Z" stroke="${col}" stroke-width="1.2" stroke-linejoin="round" fill="${col}"/><line x1="8.5" y1="10" x2="15.5" y2="10" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    wedge_offload: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="3.5" cy="5" r="2.2" stroke="${col}" stroke-width="1.3"/><rect x="7" y="3" width="14" height="4" rx="2" stroke="${col}" stroke-width="1.3"/><path d="M18.5 5 Q17 3.6 15.5 5 Q17 6.4 18.5 5" stroke="${col}" stroke-width="0.9" stroke-linecap="round"/><path d="M1 15 L1 17 L8 17 L8 13 Z" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 16.5 L10 14 M11.2 16.5 L11.2 13.5 M12.4 16.5 L12.4 14 M13.6 16.5 L13.6 14.5" stroke="${col}" stroke-width="0.9" stroke-linecap="round"/><path d="M10 16.5 Q9.5 18 10 18.5 L13.6 18.5 Q14.2 18 13.6 16.5" stroke="${col}" stroke-width="1" stroke-linejoin="round"/><path d="M15 13 L15 17 L22 17 L22 15 Z" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    air_supply: (col) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M3 20 L3 4 L21 4 L21 20" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/><line x1="2" y1="20" x2="22" y2="20" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/><path d="M6 10 Q8.5 7.5 11 10 Q13.5 12.5 16 10 Q18.5 7.5 20 10" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/><path d="M6 15 Q8.5 12.5 11 15 Q13.5 17.5 16 15 Q18.5 12.5 20 15" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/><circle cx="19" cy="4" r="4" fill="${col}"/><polyline points="16.8,4 18.5,5.8 21.5,2.2" stroke="white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  const svgToDataUri = (svg) => `data:image/svg+xml;base64,${btoa(svg)}`;

  avgMetrics.forEach((m, i) => {
    const cx = 0.38 + i * (cardW + cardGap);
    const col = pctColor(m.avg);
    const hexCol = `#${col}`;
    s2.addShape(pres.shapes.RECTANGLE, { x: cx, y: cardY, w: cardW, h: cardH, fill: { color: BRAND.white }, line: { color: BRAND.light }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.08 } });
    s2.addShape(pres.shapes.RECTANGLE, { x: cx, y: cardY, w: cardW, h: 0.12, fill: { color: col }, line: { color: col } });
    // Icon
    if (ICON_SVGS[m.id]) {
      s2.addImage({ data: svgToDataUri(ICON_SVGS[m.id](hexCol)), x: cx + (cardW - 0.45) / 2, y: cardY + 0.16, w: 0.45, h: 0.45 });
    }
    s2.addText(m.label, { x: cx + 0.1, y: cardY + 0.68, w: cardW - 0.2, h: 0.56, fontSize: 9, fontFace: "Calibri", color: BRAND.inkLight, align: "center", margin: 0 });
    s2.addText(m.avg !== null ? `${m.avg}%` : "—", { x: cx + 0.05, y: cardY + 1.22, w: cardW - 0.1, h: 0.65, fontSize: 26, fontFace: "Georgia", color: m.avg !== null ? col : BRAND.inkLight, bold: true, align: "center", margin: 0 });
    s2.addShape(pres.shapes.RECTANGLE, { x: cx + 0.15, y: cardY + 1.95, w: cardW - 0.3, h: 0.14, fill: { color: BRAND.light }, line: { color: BRAND.light } });
    if (m.avg !== null) {
      const barW = Math.max(0.04, ((cardW - 0.3) * m.avg) / 100);
      s2.addShape(pres.shapes.RECTANGLE, { x: cx + 0.15, y: cardY + 1.95, w: barW, h: 0.14, fill: { color: col }, line: { color: col } });
    }
    const status = m.avg === null ? "N/A" : m.avg >= 90 ? "ON TARGET" : m.avg >= 70 ? "MONITOR" : "NEEDS ATTENTION";
    s2.addText(status, { x: cx + 0.05, y: cardY + 2.25, w: cardW - 0.1, h: 0.25, fontSize: 7, fontFace: "Calibri", color: m.avg !== null ? col : BRAND.inkLight, align: "center", bold: true, charSpacing: 1, margin: 0 });
  });
  [["90%+", BRAND.green, "On Target"], ["70-89%", BRAND.amber, "Monitor"], ["< 70%", BRAND.red, "Needs Attention"]].forEach(([range, color, label], i) => {
    const lx = 0.38 + i * 3.1;
    s2.addShape(pres.shapes.RECTANGLE, { x: lx, y: 5.1, w: 0.18, h: 0.18, fill: { color }, line: { color } });
    s2.addText(`${range} — ${label}`, { x: lx + 0.25, y: 5.08, w: 2.6, h: 0.22, fontSize: 9, fontFace: "Calibri", color: BRAND.inkLight, margin: 0 });
  });

  // ── SLIDE 3: TREND CHART ──────────────────────────────────────────────────
  const s3 = pres.addSlide();
  s3.background = { color: BRAND.bg };
  addSectionLabel(s3, "COMPLIANCE TRENDS");
  s3.addText("Metric Performance Overview", { x: 0.38, y: 0.68, w: 9.3, h: 0.5, fontSize: 24, fontFace: "Georgia", color: BRAND.ink, bold: true, margin: 0 });
  s3.addText("Average compliance percentage per metric", { x: 0.38, y: 1.18, w: 9.3, h: 0.28, fontSize: 12, fontFace: "Calibri", color: BRAND.inkLight, margin: 0 });
  s3.addChart(pres.charts.BAR, [{ name: "Avg Compliance %", labels: avgMetrics.map(m => m.label), values: avgMetrics.map(m => m.avg ?? 0) }], {
    x: 0.38, y: 1.55, w: 9.3, h: 3.7, barDir: "col",
    chartColors: avgMetrics.map(m => pctColor(m.avg)),
    chartArea: { fill: { color: BRAND.white } },
    plotArea: { fill: { color: BRAND.white } },
    catAxisLabelColor: BRAND.inkLight, valAxisLabelColor: BRAND.inkLight,
    catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    valAxisMaxVal: 100, valAxisMinVal: 0,
    valGridLine: { color: "E8E4E0", size: 0.5 }, catGridLine: { style: "none" },
    showValue: true, dataLabelColor: BRAND.ink, dataLabelFontSize: 10, dataLabelFontBold: true,
    showLegend: false,
  });
  [["90%+ Target", BRAND.green, 0.38], ["70-89% Monitor", BRAND.amber, 2.7], ["<70% Needs Attention", BRAND.red, 5.1]].forEach(([label, color, lx]) => {
    s3.addShape(pres.shapes.RECTANGLE, { x: lx, y: 5.3, w: 0.14, h: 0.14, fill: { color }, line: { color } });
    s3.addText(label, { x: lx + 0.2, y: 5.28, w: 2.2, h: 0.18, fontSize: 9, fontFace: "Calibri", color: BRAND.inkLight, margin: 0 });
  });

  // ── SLIDE 4: HOSPITAL COMPARISON (if multiple) ────────────────────────────
  if (hospitals.length > 1) {
    const s4 = pres.addSlide();
    s4.background = { color: BRAND.bg };
    addSectionLabel(s4, "HOSPITAL COMPARISON");
    s4.addText("Performance by Hospital", { x: 0.38, y: 0.68, w: 9.3, h: 0.5, fontSize: 24, fontFace: "Georgia", color: BRAND.ink, bold: true, margin: 0 });
    const hospitalAvgs = hospitals.map(h => {
      const hEntries = entries.filter(e => e.hospital === h);
      const overallVals = METRICS.flatMap(m => hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
      const overall = overallVals.length ? Math.round(overallVals.reduce((a, b) => a + b, 0) / overallVals.length) : null;
      return { hospital: h, sessions: hEntries.length, overall };
    });
    s4.addChart(pres.charts.BAR, [{ name: "Overall Avg %", labels: hospitalAvgs.map(h => h.hospital), values: hospitalAvgs.map(h => h.overall ?? 0) }], {
      x: 0.38, y: 1.3, w: 9.3, h: 3.8, barDir: "col",
      chartColors: hospitalAvgs.map(h => pctColor(h.overall)),
      chartArea: { fill: { color: BRAND.white } }, plotArea: { fill: { color: BRAND.white } },
      catAxisLabelColor: BRAND.inkLight, valAxisLabelColor: BRAND.inkLight, catAxisLabelFontSize: 10,
      valAxisMaxVal: 100, valAxisMinVal: 0,
      valGridLine: { color: "E8E4E0", size: 0.5 }, catGridLine: { style: "none" },
      showValue: true, dataLabelColor: BRAND.ink, dataLabelFontSize: 11, dataLabelFontBold: true,
      showLegend: false,
    });
    s4.addText(`Sessions: ${hospitalAvgs.map(h => `${h.hospital} (${h.sessions})`).join("  ·  ")}`, { x: 0.38, y: 5.2, w: 9.3, h: 0.28, fontSize: 10, fontFace: "Calibri", color: BRAND.inkLight, margin: 0 });
  }

  // ── SLIDE 5: SESSION HISTORY TABLE ───────────────────────────────────────
  const s5 = pres.addSlide();
  s5.background = { color: BRAND.bg };
  addSectionLabel(s5, "SESSION HISTORY");
  s5.addText("Session Log", { x: 0.38, y: 0.68, w: 9.3, h: 0.5, fontSize: 24, fontFace: "Georgia", color: BRAND.ink, bold: true, margin: 0 });

  const recentSessions = [...entries].reverse().slice(0, 12);
  const hdrOpts = (text) => ({ text, options: { fill: { color: brandPrimary }, color: BRAND.white, bold: true, fontSize: 9, fontFace: "Calibri", align: "center" } });
  const tableHeader = [hdrOpts("Date"), hdrOpts("Hospital"), hdrOpts("Location"), hdrOpts("Matt"), hdrOpts("Wedges"), hdrOpts("Turning"), hdrOpts("Matt Prop."), hdrOpts("Wdg Rm"), hdrOpts("Offload"), hdrOpts("Air"), hdrOpts("Logged By")];

  const tableRows = recentSessions.map((e, idx) => {
    const rowBg = idx % 2 === 0 ? BRAND.white : "F0EDEA";
    const metricCell = (id) => {
      const p = pct(e[`${id}_num`], e[`${id}_den`]);
      return { text: p !== null ? `${p}%` : "—", options: { fill: { color: rowBg }, color: p !== null ? pctColor(p) : BRAND.inkLight, fontSize: 9, fontFace: "Calibri", align: "center", bold: p !== null } };
    };
    return [
      { text: e.date || "—", options: { fill: { color: rowBg }, color: BRAND.ink, fontSize: 9, fontFace: "Calibri", align: "center" } },
      { text: e.hospital || "—", options: { fill: { color: rowBg }, color: brandPrimary, fontSize: 9, fontFace: "Calibri", bold: true } },
      { text: e.location || "—", options: { fill: { color: rowBg }, color: BRAND.inkLight, fontSize: 8, fontFace: "Calibri" } },
      metricCell("matt_applied"), metricCell("wedges_applied"), metricCell("turning_criteria"),
      metricCell("matt_proper"), metricCell("wedges_in_room"), metricCell("wedge_offload"), metricCell("air_supply"),
      { text: e.logged_by || "—", options: { fill: { color: rowBg }, color: BRAND.inkLight, fontSize: 8, fontFace: "Calibri" } },
    ];
  });

  s5.addTable([tableHeader, ...tableRows], {
    x: 0.38, y: 1.25, w: 9.3, rowH: 0.28,
    border: { pt: 0.5, color: BRAND.light },
    colW: [0.75, 1.1, 0.9, 0.75, 0.75, 0.75, 0.85, 0.75, 0.75, 0.65, 1.1],
  });
  if (entries.length > 12) {
    s5.addText(`Showing most recent 12 of ${entries.length} sessions`, { x: 0.38, y: 5.3, w: 9.3, h: 0.22, fontSize: 9, fontFace: "Calibri", color: BRAND.inkLight, italic: true, margin: 0 });
  }

  // ── SLIDE 6: AI SUMMARY (if available) ───────────────────────────────────
  if (summary && summary.length > 10) {
    const s6 = pres.addSlide();
    s6.background = { color: BRAND.bg };
    addSectionLabel(s6, "AI CLINICAL ANALYSIS");
    s6.addText("Clinical Insights", { x: 0.38, y: 0.68, w: 9.3, h: 0.5, fontSize: 24, fontFace: "Georgia", color: BRAND.ink, bold: true, margin: 0 });
    s6.addShape(pres.shapes.RECTANGLE, { x: 0.38, y: 1.28, w: 9.3, h: 3.8, fill: { color: BRAND.white }, line: { color: BRAND.light }, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 135, opacity: 0.06 } });
    s6.addShape(pres.shapes.RECTANGLE, { x: 0.38, y: 1.28, w: 0.22, h: 3.8, fill: { color: brandPrimary }, line: { color: brandPrimary } });
    s6.addText("✦  AI CLINICAL ANALYSIS", { x: 0.75, y: 1.42, w: 8.7, h: 0.28, fontSize: 9, fontFace: "Calibri", color: brandPrimary, bold: true, charSpacing: 2, margin: 0 });
    s6.addText(summary.slice(0, 900), { x: 0.75, y: 1.82, w: 8.7, h: 3.0, fontSize: 11, fontFace: "Calibri", color: BRAND.inkLight, lineSpacingMultiple: 1.4, valign: "top", margin: 0 });
    s6.addText(`Generated by HoverTech CareTrack${preparedBy ? ` · Prepared by ${preparedBy}` : ""}`, { x: 0.38, y: 5.28, w: 9.3, h: 0.22, fontSize: 9, fontFace: "Calibri", color: BRAND.inkLight, italic: true, align: "right", margin: 0 });
  }

  // ── CLOSING SLIDE ─────────────────────────────────────────────────────────
  const sEnd = pres.addSlide();
  sEnd.background = { color: brandPrimary };
  sEnd.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: 0, w: 0.4, h: 5.625, fill: { color: BRAND.accent }, line: { color: BRAND.accent } });
  sEnd.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.22, h: 5.625, fill: { color: "3d5a62" }, line: { color: "3d5a62" } });
  sEnd.addText("HOVERTECH", { x: 0.55, y: 1.8, w: 9.0, h: 0.7, fontSize: 38, fontFace: "Georgia", color: BRAND.white, bold: true, align: "center", margin: 0 });
  sEnd.addText("an Etac Company", { x: 0.55, y: 2.5, w: 9.0, h: 0.4, fontSize: 16, fontFace: "Calibri", color: "A8C8D0", italic: true, align: "center", margin: 0 });
  sEnd.addShape(pres.shapes.RECTANGLE, { x: 3.5, y: 3.05, w: 3.0, h: 0.04, fill: { color: "7CA8B4" }, line: { color: "7CA8B4" } });
  sEnd.addText("CareTrack · Wound Care Compliance", { x: 0.55, y: 3.22, w: 9.0, h: 0.3, fontSize: 11, fontFace: "Calibri", color: "7CA8B4", align: "center", charSpacing: 2, margin: 0 });

  const dateStr = new Date().toISOString().slice(0, 10);
  const hospitalSlug = hospitalFilter && hospitalFilter !== "All" ? "_" + hospitalFilter.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_") : "";
  pres.writeFile({ fileName: `CareTrack_Report${hospitalSlug}_${dateStr}.pptx` });
}

// generatePdf v2.8.1
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

const MAYO_METRICS   = [{ id: "air_reposition", label: "Air Used to Reposition Patient" }];
const KAISER_METRICS = [
  { id: "heel_boots", label: "Heel Boots" },
  { id: "turn_clock", label: "Turn Clock" },
];
const isMayo   = (hospital) => hospital && hospital.toLowerCase().includes("mayo");
const isKaiser = (hospital) => hospital && hospital.toLowerCase().includes("kaiser");
const getMetrics = (hospital) => {
  let m = [...METRICS];
  if (isMayo(hospital))   m = [...m, ...MAYO_METRICS];
  if (isKaiser(hospital)) m = [...m, ...KAISER_METRICS];
  return m;
};

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
  // Top bar
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

export async function generatePdf(entries, summary = "", returnBase64 = false, hospitalFilter = "", preparedBy = "", branding = null, chartData = [], mom = null, allEntries = []) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Apply branding accent colour if provided
  const brandAccent = branding?.accentColor
    ? branding.accentColor.replace("#","").match(/.{2}/g).map(v => parseInt(v,16))
    : BRAND.primary;
  const brandHeader = branding?.accentColor ? brandAccent : BRAND.primary;

  const hasMayo   = entries.some(e => isMayo(e.hospital));
  const hasKaiser = entries.some(e => isKaiser(e.hospital));
  const summaryMetrics = [...METRICS, ...(hasMayo ? MAYO_METRICS : []), ...(hasKaiser ? KAISER_METRICS : [])];

  const avgMetrics = summaryMetrics.map(m => {
    const vals = entries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
    return { ...m, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  }).sort((a, b) => {
    const rank = (v) => v === null ? 3 : v >= 90 ? 0 : v >= 70 ? 1 : 2;
    return rank(a.avg) - rank(b.avg);
  });

  const hospitals = [...new Set(entries.map(e => e.hospital).filter(Boolean))].sort();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Count pages for pagination
  let totalPages = 3;
  if (mom?.hasData) totalPages++;
  if (hospitals.length > 1) totalPages++;
  if (summary && summary.length > 10) totalPages++;
  const hasBedData = entries.some(e => e.bed_data && e.bed_data.length > 0);
  if (hasBedData) totalPages++;

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

  // drawIcon — faithful jsPDF primitive translation of MetricIcons.jsx SVG paths
  // Coords in 24-unit SVG space; x()/y() map to mm centered at (cx,cy); sc() scales stroke/radius
  const drawIcon = (id, cx, cy, sz, rgb) => {
    const s = sz / 24;
    const x = (v) => cx - sz / 2 + v * s;
    const y = (v) => cy - sz / 2 + v * s;
    const sc = (v) => v * s;
    doc.setDrawColor(...rgb);
    doc.setFillColor(...rgb);

    if (id === "matt_applied") {
      // <rect x="2" y="7" width="20" height="10" rx="2.5" stroke strokeWidth="1.6"/>
      doc.setLineWidth(sc(1.6)); doc.roundedRect(x(2), y(7), sc(20), sc(10), sc(2.5), sc(2.5), "S");
      // quilting lines strokeOpacity="0.4" → use inkLight
      doc.setDrawColor(...BRAND.inkLight); doc.setLineWidth(sc(1));
      doc.line(x(8), y(7), x(8), y(17));
      doc.line(x(16), y(7), x(16), y(17));
      doc.line(x(2), y(12), x(22), y(12));
      // badge circle filled
      doc.setDrawColor(...rgb); doc.setFillColor(...rgb);
      doc.setLineWidth(0); doc.circle(x(18.5), y(6.5), sc(4), "F");
      // checkmark
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.4));
      doc.line(x(16.2), y(6.5), x(18), y(8.2)); doc.line(x(18), y(8.2), x(21), y(5));

    } else if (id === "wedges_applied") {
      // two wedge triangles
      doc.setDrawColor(...rgb); doc.setLineWidth(sc(1.4));
      doc.line(x(2), y(19), x(7), y(10)); doc.line(x(7), y(10), x(12), y(19)); doc.line(x(2), y(19), x(12), y(19));
      doc.line(x(12), y(19), x(17), y(10)); doc.line(x(17), y(10), x(22), y(19)); doc.line(x(12), y(19), x(22), y(19));
      // badge
      doc.setLineWidth(0); doc.circle(x(19), y(7), sc(4), "F");
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      doc.line(x(16.8), y(7), x(18.5), y(8.8)); doc.line(x(18.5), y(8.8), x(21.5), y(5.2));

    } else if (id === "turning_criteria") {
      // clock circle
      doc.setDrawColor(...rgb); doc.setLineWidth(sc(1.5)); doc.circle(x(12), y(10), sc(8.5), "S");
      // hands
      doc.setLineWidth(sc(1.4));
      doc.line(x(12), y(10), x(12), y(5.5));
      doc.line(x(12), y(10), x(15.5), y(12));
      // center dot
      doc.setLineWidth(0); doc.circle(x(12), y(10), sc(1), "F");
      // patient head: white filled circle with stroke
      doc.setFillColor(...BRAND.white); doc.setDrawColor(...rgb); doc.setLineWidth(sc(1.4));
      doc.circle(x(12), y(17), sc(3), "FD");
      // shoulder arc (Q curve → 3-segment approximation)
      doc.setLineWidth(sc(1.5));
      doc.line(x(7), y(24), x(8.5), y(21.5));
      doc.line(x(8.5), y(21.5), x(15.5), y(21.5));
      doc.line(x(15.5), y(21.5), x(17), y(24));
      // cover gap line in white
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.5));
      doc.line(x(8.5), y(20.2), x(15.5), y(20.2));
      doc.setDrawColor(...rgb); doc.setFillColor(...rgb);

    } else if (id === "matt_proper") {
      // MATT pad rectangle
      doc.setLineWidth(sc(1.4)); doc.roundedRect(x(1), y(5), sc(17), sc(14), sc(2), sc(2), "S");
      // four-way arrow: vertical line
      doc.setLineWidth(sc(1.2));
      doc.line(x(9.5), y(9), x(9.5), y(15));
      doc.line(x(6.5), y(12), x(12.5), y(12));
      // arrowheads
      doc.setLineWidth(sc(1.1));
      doc.line(x(8.2), y(10.2), x(9.5), y(9));   doc.line(x(9.5), y(9),  x(10.8), y(10.2)); // up
      doc.line(x(8.2), y(13.8), x(9.5), y(15));   doc.line(x(9.5), y(15), x(10.8), y(13.8)); // down
      doc.line(x(7.8), y(10.7), x(6.5), y(12));   doc.line(x(6.5), y(12), x(7.8), y(13.3));  // left
      doc.line(x(11.2), y(10.7), x(12.5), y(12)); doc.line(x(12.5), y(12), x(11.2), y(13.3)); // right
      // shield badge: white fill then stroke, then checkmark in rgb
      doc.setFillColor(...BRAND.white); doc.setDrawColor(...rgb); doc.setLineWidth(sc(1.3));
      // "M19 2 L23 4 L23 8 Q23 11.5 19 13 Q15 11.5 15 8 L15 4 Z"
      doc.line(x(19), y(2),  x(23), y(4));
      doc.line(x(23), y(4),  x(23), y(8));
      doc.line(x(23), y(8),  x(21), y(11)); doc.line(x(21), y(11), x(19), y(13)); // approx Q
      doc.line(x(19), y(13), x(17), y(11)); doc.line(x(17), y(11), x(15), y(8));  // approx Q
      doc.line(x(15), y(8),  x(15), y(4));
      doc.line(x(15), y(4),  x(19), y(2));
      // check in rgb color
      doc.setDrawColor(...rgb);
      doc.line(x(17.2), y(7.5), x(18.8), y(9.2)); doc.line(x(18.8), y(9.2), x(21.2), y(5.8));

    } else if (id === "wedges_in_room") {
      // map pin outline: "M12 2 C8.5 2 6 4.8 6 8 C6 12.5 12 20 12 20 C12 20 18 12.5 18 8 C18 4.8 15.5 2 12 2"
      // approximate bezier as polyline segments
      doc.setLineWidth(sc(1.4));
      doc.line(x(12), y(2),  x(9),  y(2.8));
      doc.line(x(9),  y(2.8), x(6.5), y(4.8));
      doc.line(x(6.5), y(4.8), x(6),  y(8));
      doc.line(x(6),  y(8),   x(7.5), y(12));
      doc.line(x(7.5), y(12), x(12), y(20));
      doc.line(x(12), y(20), x(16.5), y(12));
      doc.line(x(16.5), y(12), x(18), y(8));
      doc.line(x(18), y(8),  x(17.5), y(4.8));
      doc.line(x(17.5), y(4.8), x(15), y(2.8));
      doc.line(x(15), y(2.8), x(12), y(2));
      // wedge triangle inside, filled: "M8.5 10 L12 5.5 L15.5 10 Z"
      doc.setLineWidth(0);
      doc.triangle(x(8.5), y(10), x(12), y(5.5), x(15.5), y(10), "F");
      // baseline
      doc.setLineWidth(sc(1.2));
      doc.line(x(8.5), y(10), x(15.5), y(10));

    } else if (id === "wedge_offload") {
      // heel circle
      doc.setLineWidth(sc(1.3)); doc.circle(x(3.5), y(5), sc(2.2), "S");
      // MATT pad pill
      doc.roundedRect(x(7), y(3), sc(14), sc(4), sc(2), sc(2), "S");
      // inner loop: "M18.5 5 Q17 3.6 15.5 5 Q17 6.4 18.5 5"
      doc.setLineWidth(sc(0.9));
      doc.line(x(18.5), y(5), x(17), y(3.8)); doc.line(x(17), y(3.8), x(15.5), y(5));
      doc.line(x(15.5), y(5), x(17), y(6.2)); doc.line(x(17), y(6.2), x(18.5), y(5));
      // left wedge: "M1 15 L1 17 L8 17 L8 13 Z"
      doc.setLineWidth(sc(1.3));
      doc.line(x(1), y(15), x(1), y(17)); doc.line(x(1), y(17), x(8), y(17));
      doc.line(x(8), y(17), x(8), y(13)); doc.line(x(8), y(13), x(1), y(15));
      // stop hand fingers
      doc.setLineWidth(sc(0.9));
      doc.line(x(10),   y(16.5), x(10),   y(14));
      doc.line(x(11.2), y(16.5), x(11.2), y(13.5));
      doc.line(x(12.4), y(16.5), x(12.4), y(14));
      doc.line(x(13.6), y(16.5), x(13.6), y(14.5));
      // palm base arc approx
      doc.setLineWidth(sc(1));
      doc.line(x(10), y(16.5), x(10),   y(18.5)); doc.line(x(10),   y(18.5), x(13.6), y(18.5));
      doc.line(x(13.6), y(18.5), x(13.6), y(16.5));
      // right wedge: "M15 13 L15 17 L22 17 L22 15 Z"
      doc.setLineWidth(sc(1.3));
      doc.line(x(15), y(13), x(15), y(17)); doc.line(x(15), y(17), x(22), y(17));
      doc.line(x(22), y(17), x(22), y(15)); doc.line(x(22), y(15), x(15), y(13));

    } else if (id === "air_supply" || id === "air_reposition") {
      // room outline: "M3 20 L3 4 L21 4 L21 20" + base line
      doc.setLineWidth(sc(1.6));
      doc.line(x(3), y(20), x(3), y(4));
      doc.line(x(3), y(4),  x(21), y(4));
      doc.line(x(21), y(4), x(21), y(20));
      doc.line(x(2), y(20), x(22), y(20));
      // wave 1: "M6 10 Q8.5 7.5 11 10 Q13.5 12.5 16 10 Q18.5 7.5 20 10"
      doc.setLineWidth(sc(1.5));
      doc.line(x(6), y(10), x(8.5), y(7.5)); doc.line(x(8.5), y(7.5), x(11), y(10));
      doc.line(x(11), y(10), x(13.5), y(12.5)); doc.line(x(13.5), y(12.5), x(16), y(10));
      doc.line(x(16), y(10), x(18.5), y(7.5)); doc.line(x(18.5), y(7.5), x(20), y(10));
      // wave 2: "M6 15 Q8.5 12.5 11 15 Q13.5 17.5 16 15 Q18.5 12.5 20 15"
      doc.line(x(6), y(15), x(8.5), y(12.5)); doc.line(x(8.5), y(12.5), x(11), y(15));
      doc.line(x(11), y(15), x(13.5), y(17.5)); doc.line(x(13.5), y(17.5), x(16), y(15));
      doc.line(x(16), y(15), x(18.5), y(12.5)); doc.line(x(18.5), y(12.5), x(20), y(15));
      // badge: white circle then filled circle (matches SVG double-circle trick)
      doc.setFillColor(...BRAND.white); doc.setLineWidth(0); doc.circle(x(19), y(4), sc(4), "F");
      doc.setFillColor(...rgb); doc.circle(x(19), y(4), sc(4), "F");
      // check or reposition cross
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      if (id === "air_reposition") {
        doc.line(x(19), y(1.5), x(19), y(6.5));
        doc.line(x(16.5), y(4), x(21.5), y(4));
      } else {
        doc.line(x(16.8), y(4), x(18.5), y(5.8)); doc.line(x(18.5), y(5.8), x(21.5), y(2.2));
      }
      doc.setDrawColor(...rgb); doc.setFillColor(...rgb);

    } else if (id === "heel_boots") {
      // Side-profile boot: shaft + ankle curve + foot + toe + sole
      // "M3 2 L3 18 Q3 20.5 1.5 22 L1.5 23 L22 23 Q24 23 24 21 Q24 19 22 19 L18 19 L18 2 Z"
      doc.setLineWidth(sc(1.4));
      doc.line(x(3),  y(2),  x(3),  y(18));   // left shaft side down
      doc.line(x(3),  y(18), x(1.5), y(22));  // ankle curve (approx)
      doc.line(x(1.5),y(22), x(1.5), y(23));  // down to sole
      doc.line(x(1.5),y(23), x(22), y(23));   // toe sole (drawn as thick line below)
      doc.line(x(22), y(23), x(22), y(19));   // toe right side up
      doc.line(x(22), y(19), x(18), y(19));   // top of toe box
      doc.line(x(18), y(19), x(18), y(2));    // right shaft side down
      doc.line(x(18), y(2),  x(3),  y(2));    // shaft top
      // Sole underline
      doc.setLineWidth(sc(1.7));
      doc.line(x(1.5), y(23), x(22), y(23));
      // Cuff line
      doc.setLineWidth(sc(1.0));
      doc.setDrawColor(...BRAND.inkLight);
      doc.line(x(3), y(5), x(18), y(5));
      doc.setDrawColor(...rgb);
      // Ankle strap: "M3 15 Q10 13 18 15"
      doc.setLineWidth(sc(1.1));
      doc.line(x(3), y(15), x(10), y(13)); doc.line(x(10), y(13), x(18), y(15));
      // Badge
      doc.setLineWidth(0); doc.circle(x(19), y(2), sc(4), "F");
      doc.setDrawColor(...BRAND.white); doc.setLineWidth(sc(1.3));
      doc.line(x(16.8), y(2), x(18.6), y(3.8)); doc.line(x(18.6), y(3.8), x(21.6), y(1));
      doc.setDrawColor(...rgb); doc.setFillColor(...rgb);

    } else if (id === "turn_clock") {
      // Clock circle
      doc.setLineWidth(sc(1.5)); doc.circle(x(12), y(12), sc(7.5), "S");
      // Hands
      doc.setLineWidth(sc(1.4));
      doc.line(x(12), y(12), x(12), y(7.5));
      doc.line(x(12), y(12), x(15.5), y(14));
      // Center dot
      doc.setLineWidth(0); doc.circle(x(12), y(12), sc(1), "F");
      // CCW arc top-left: approximate "M5.5 8 A8.5 8.5 0 0 1 12 3.5" as segments
      doc.setLineWidth(sc(1.4));
      doc.line(x(5.5), y(8),   x(7),   y(5.5));
      doc.line(x(7),   y(5.5), x(9),   y(4));
      doc.line(x(9),   y(4),   x(12),  y(3.5));
      // CCW arrowhead: "points 5.5,8 3.5,5.5 7,5"
      doc.setLineWidth(sc(1.3));
      doc.line(x(5.5), y(8),   x(3.5), y(5.5));
      doc.line(x(3.5), y(5.5), x(7),   y(5));
      // CW arc bottom-right: approximate "M18.5 16 A8.5 8.5 0 0 1 12 20.5"
      doc.setLineWidth(sc(1.4));
      doc.line(x(18.5), y(16),   x(17),   y(18.5));
      doc.line(x(17),   y(18.5), x(15),   y(20));
      doc.line(x(15),   y(20),   x(12),   y(20.5));
      // CW arrowhead: "points 18.5,16 20.5,18.5 17,19"
      doc.setLineWidth(sc(1.3));
      doc.line(x(18.5), y(16),   x(20.5), y(18.5));
      doc.line(x(20.5), y(18.5), x(17),   y(19));
    }
  };

  // ── GROUPED METRIC LAYOUT ─────────────────────────────────────────────────
  const GROUPS = [
    { label: "PATIENT MET CRITERIA", ids: ["turning_criteria"] },
    { label: "MATT COMPLIANCE",  ids: ["matt_applied", "matt_proper"] },
    { label: "WEDGE COMPLIANCE", ids: ["wedges_in_room", "wedges_applied", "wedge_offload"] },
    { label: "AIR SUPPLY",       ids: ["air_supply"] },
  ];
  if (hasMayo) GROUPS.splice(3, 0, { label: "AIR REPOSITIONING", ids: ["air_reposition"] });

  const metricLookup = {};
  avgMetrics.forEach(m => { metricLookup[m.id] = m; });
  summaryMetrics.forEach(m => { if (!metricLookup[m.id]) metricLookup[m.id] = { ...m, avg: null }; });

  const NATL = { turning_criteria: 81, matt_applied: 78, matt_proper: 78, wedges_in_room: 74, wedges_applied: 59, wedge_offload: 58, air_supply: 81, air_reposition: 75 };
  if (allEntries.length > 0) {
    summaryMetrics.forEach(m => {
      const vals = allEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
      if (vals.length) NATL[m.id] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
  }
  const PAGE_LEFT = 14, PAGE_W = 182, CARD_H = 40, GAP = 3, SECTION_H = 6;
  let curY = 48;

  const drawCard = (m, cx, cy, cw) => {
    const color = pctColor(m.avg);
    doc.setFillColor(...BRAND.white);
    doc.roundedRect(cx, cy, cw, CARD_H, 2, 2, "F");
    doc.setFillColor(...color);
    doc.rect(cx, cy, cw, 2, "F");

    // Icon — top right, 10mm square
    drawIcon(m.id, cx + cw - 8, cy + 9, 10, color);

    // Label — top left
    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(m.label, cw - 18), cx + 4, cy + 7);

    // Big percentage
    doc.setTextColor(...color);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(m.avg !== null ? `${m.avg}%` : "—", cx + 4, cy + 24);

    // Progress bar
    const barX = cx + 4, barY = cy + 27, barW = cw - 8;
    doc.setFillColor(...BRAND.light);
    doc.rect(barX, barY, barW, 2.5, "F");
    if (m.avg !== null) {
      doc.setFillColor(...color);
      doc.rect(barX, barY, Math.max(0.5, barW * m.avg / 100), 2.5, "F");
    }

    // National avg tick + label + delta
    const natl = NATL[m.id];
    if (natl !== undefined) {
      const tickX = barX + barW * natl / 100;
      doc.setFillColor(...BRAND.inkLight);
      doc.rect(tickX - 0.4, barY - 1, 0.8, 4.5, "F");
      doc.setTextColor(...BRAND.inkLight);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "normal");
      doc.text(`National avg: ${natl}%`, cx + 4, cy + 36);
      if (m.avg !== null) {
        const delta = m.avg - natl;
        const dColor = delta >= 0 ? BRAND.green : BRAND.red;
        doc.setTextColor(...dColor);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text(`${delta >= 0 ? "+" : "-"}${Math.abs(delta)}%`, cx + cw - 4, cy + 36, { align: "right" });
      }
    }
  };

  GROUPS.forEach(group => {
    const rowH = SECTION_H + CARD_H + 5;
    if (curY + rowH > 276) {
      doc.addPage();
      addHeader(doc, 2, totalPages, preparedBy, brandHeader);
      doc.setFillColor(...BRAND.bg);
      doc.rect(0, 14, 210, 283, "F");
      curY = 20;
    }
    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text(group.label, PAGE_LEFT, curY + 4);
    curY += SECTION_H;
    const n = group.ids.length;
    const cardW = (PAGE_W - GAP * (n - 1)) / n;
    group.ids.forEach((id, idx) => {
      const m = metricLookup[id];
      if (!m) return;
      drawCard(m, PAGE_LEFT + idx * (cardW + GAP), curY, cardW);
    });
    curY += CARD_H + 5;
  });

  // Legend
  const legendY = curY + 2;
  if (legendY + 20 > 276) {
    doc.addPage();
    addHeader(doc, 2, totalPages, preparedBy, brandHeader);
    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");
    curY = 20;
  }
  [[BRAND.green, "90%+ \u2014 On Target"], [BRAND.amber, "70-89% \u2014 Monitor"], [BRAND.red, "< 70% \u2014 Needs Attention"]].forEach(([color, label], i) => {
    doc.setFillColor(...color);
    doc.rect(14 + i * 64, legendY, 4, 4, "F");
    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, 22 + i * 64, legendY + 3.5);
  });

  // ── KAISER SHELF ──────────────────────────────────────────────────────────
  if (hasKaiser) {
    const kaiserAvgs = KAISER_METRICS.map(m => {
      const vals = entries
        .filter(e => isKaiser(e.hospital))
        .map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`]))
        .filter(v => v !== null);
      return { ...m, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
    });

    let shelfY = legendY + 10;
    if (shelfY + 52 > 276) {
      doc.addPage();
      addHeader(doc, 2, totalPages, preparedBy, brandHeader);
      doc.setFillColor(...BRAND.bg);
      doc.rect(0, 14, 210, 283, "F");
      shelfY = 20;
    }
    const SHELF_H = 42;
    const SHELF_CARD_H = 28;

    // Shelf background band
    doc.setFillColor(235, 232, 230);
    doc.roundedRect(PAGE_LEFT, shelfY, PAGE_W, SHELF_H, 2, 2, "F");

    // Section label
    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text("KAISER PERMANENTE", PAGE_LEFT + 4, shelfY + 5);

    // Two cards side by side
    const kCardW = (PAGE_W - GAP) / 2;
    kaiserAvgs.forEach((m, idx) => {
      const color = pctColor(m.avg);
      const cx = PAGE_LEFT + idx * (kCardW + GAP);
      const cy = shelfY + 8;

      doc.setFillColor(...BRAND.white);
      doc.roundedRect(cx, cy, kCardW, SHELF_CARD_H, 2, 2, "F");
      doc.setFillColor(...color);
      doc.rect(cx, cy, kCardW, 2, "F");

      // Icon — top right
      drawIcon(m.id, cx + kCardW - 7, cy + 8, 9, color);

      // Label
      doc.setTextColor(...BRAND.inkLight);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(m.label, cx + 4, cy + 7);

      // Percentage
      doc.setTextColor(...color);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(m.avg !== null ? `${m.avg}%` : "—", cx + 4, cy + 20);

      // Progress bar
      const barX = cx + 4, barY = cy + 23, barW = kCardW - 8;
      doc.setFillColor(...BRAND.light);
      doc.rect(barX, barY, barW, 2, "F");
      if (m.avg !== null) {
        doc.setFillColor(...color);
        doc.rect(barX, barY, Math.max(0.5, barW * m.avg / 100), 2, "F");
      }
    });
  }

  // ── PAGE: MONTH-OVER-MONTH ────────────────────────────────────────────────
  let histPageNum = 3;
  if (mom?.hasData) {
    doc.addPage();
    addHeader(doc, histPageNum, totalPages, preparedBy, brandHeader);
    histPageNum++;
    doc.setFillColor(...BRAND.bg); doc.rect(0, 14, 210, 283, "F");
    doc.setTextColor(...brandHeader); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("MONTH-OVER-MONTH COMPARISON", 14, 24);
    doc.setTextColor(...BRAND.ink); doc.setFontSize(20);
    doc.text("Monthly Performance", 14, 35);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...BRAND.inkLight);
    doc.text(`${mom.lastMonth}  →  ${mom.thisMonth}`, 14, 42);
    [{ label: mom.thisMonth, value: mom.thisAvg !== null ? `${mom.thisAvg}%` : "—", sub: `${mom.thisSessions} sessions`, color: mom.thisAvg !== null ? pctColor(mom.thisAvg) : BRAND.inkLight },
     { label: mom.lastMonth, value: mom.lastAvg !== null ? `${mom.lastAvg}%` : "—", sub: `${mom.lastSessions} sessions`, color: mom.lastAvg !== null ? pctColor(mom.lastAvg) : BRAND.inkLight },
     { label: "Change", value: mom.delta !== null ? `${mom.delta > 0 ? "+" : ""}${mom.delta}%` : "—", sub: "vs last month", color: mom.delta === null ? BRAND.inkLight : mom.delta > 0 ? BRAND.green : BRAND.red },
    ].forEach((card, i) => {
      const cx = 14 + i * 62;
      doc.setFillColor(...BRAND.white); doc.roundedRect(cx, 48, 58, 28, 2, 2, "F");
      doc.setFillColor(...card.color); doc.rect(cx, 48, 58, 2, "F");
      doc.setTextColor(...BRAND.inkLight); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(card.label, cx + 29, 55, { align: "center" });
      doc.setTextColor(...card.color); doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text(card.value, cx + 29, 67, { align: "center" });
      doc.setTextColor(...BRAND.inkLight); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(card.sub, cx + 29, 73, { align: "center" });
    });
    const momRows = mom.metricDeltas.map(m => [m.label, m.last !== null ? `${m.last}%` : "—", m.this !== null ? `${m.this}%` : "—", m.delta === null ? "—" : m.delta > 0 ? `+${m.delta}%` : `${m.delta}%`, m.delta === null ? "neutral" : m.delta > 0 ? "up" : "down"]);
    autoTable(doc, { startY: 84, head: [["Metric", mom.lastMonth, mom.thisMonth, "Change", "Trend"]], body: momRows, styles: { fontSize: 8, cellPadding: 2.5, font: "helvetica" }, headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 8, halign: "center" }, alternateRowStyles: { fillColor: [240, 237, 234] }, columnStyles: { 0: { cellWidth: 58, halign: "left" }, 1: { cellWidth: 28, halign: "center" }, 2: { cellWidth: 28, halign: "center" }, 3: { cellWidth: 24, halign: "center" }, 4: { cellWidth: 36, halign: "center" } }, didParseCell: (data) => {
        if (data.column.index === 3 && data.section === "body") { const v = parseFloat(data.cell.raw); if (!isNaN(v)) data.cell.styles.textColor = v > 0 ? BRAND.green : v < 0 ? BRAND.red : BRAND.inkLight; }
        if (data.column.index === 4 && data.section === "body") { data.cell.text = [""]; }
      }, didDrawCell: (data) => {
        if (data.column.index === 4 && data.section === "body") {
          const val = momRows[data.row.index]?.[4];
          const color = val === "up" ? BRAND.green : val === "down" ? BRAND.red : BRAND.inkLight;
          const r = 1.8;
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2;
          doc.setFillColor(...color);
          doc.circle(cx, cy, r, "F");
        }
      }, margin: { left: 14, right: 14 }, theme: "plain" });
  }

  // ── PAGE 3: SESSION HISTORY TABLE ─────────────────────────────────────────
  doc.addPage();
  addHeader(doc, histPageNum, totalPages, preparedBy, brandHeader);

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

  const HISTORY_BUCKETS = [
    { label: "Matt Compliance",  ids: ["matt_applied", "matt_proper"],                      single: false },
    { label: "Wedge Compliance", ids: ["wedges_in_room", "wedges_applied", "wedge_offload"], single: false },
    { label: "Turning",          ids: ["turning_criteria"],                                  single: true },
    ...(hasMayo   ? [{ label: "Air Repos.",     ids: ["air_reposition"], single: true }] : []),
    { label: "Air Supply",       ids: ["air_supply"],                                        single: true },
    ...(hasKaiser ? [{ label: "Kaiser Metrics", ids: ["heel_boots", "turn_clock"], single: false }] : []),
  ];

  const METRIC_SHORT = {
    matt_applied: "Applied", matt_proper: "Properly",
    wedges_in_room: "In Room", wedges_applied: "Applied", wedge_offload: "Offloading",
    turning_criteria: "Turning", air_supply: "Air Supply",
    air_reposition: "Air Repos.", heel_boots: "Heel Boots", turn_clock: "Turn Clock",
  };

  // Build plain-text rows (autoTable needs strings for layout/height calculation)
  // Bucket columns: each line is "Label: XX%" joined by newline so autoTable sizes row height
  const tableRows = recentSessions.map(e => [
    e.created_at ? new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : e.date,
    e.hospital || "—",
    e.location || "—",
    ...HISTORY_BUCKETS.map(b =>
      b.ids.map(id => {
        const p = pct(e[`${id}_num`], e[`${id}_den`]);
        return b.single
          ? (p !== null ? `${p}%` : "—")
          : `${METRIC_SHORT[id]}: ${p !== null ? `${p}%` : "—"}`;
      }).join("\n")
    ),
    e.logged_by || "—",
    e.notes || "",
  ]);

  // Lookup: [rowIdx][bucketColIdx] → array of { label, pct }
  // bucketColIdx 0=Matt(col3), 1=Wedge(col4), 2=Turning(col5), 3=Air(col6)
  const cellData = recentSessions.map(e =>
    HISTORY_BUCKETS.map(b =>
      b.ids.map(id => ({ label: METRIC_SHORT[id], p: pct(e[`${id}_num`], e[`${id}_den`]) }))
    )
  );

  // Dynamic column widths: fixed cols = 16+22+16+18+16 = 88mm, remaining split among buckets
  const fixedColsW = 88;
  const bucketTotalW = 182 - fixedColsW;
  const bucketW = Math.floor(bucketTotalW / HISTORY_BUCKETS.length);
  const bucketColStyles = Object.fromEntries(HISTORY_BUCKETS.map((_, i) => [i + 3, { cellWidth: bucketW }]));

  autoTable(doc, {
    startY: 40,
    head: [["Date", "Hospital", "Unit", ...HISTORY_BUCKETS.map(b => b.label), "Logged By", "Notes"]],
    body: tableRows,
    styles: { fontSize: 6.5, cellPadding: 2, font: "helvetica", valign: "top", textColor: BRAND.ink, fillColor: BRAND.white },
    headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [240, 237, 234] },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 22 },
      2: { cellWidth: 16 },
      ...bucketColStyles,
      [HISTORY_BUCKETS.length + 3]: { cellWidth: 18 },
      [HISTORY_BUCKETS.length + 4]: { cellWidth: 16, fontStyle: "italic" },
    },
    margin: { left: 14, right: 14 },
    theme: "plain",
    willDrawCell: (data) => {
      if (data.section !== "body") return;
      const bucketIdx = data.column.index - 3;
      if (bucketIdx >= 0 && bucketIdx < HISTORY_BUCKETS.length) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      const bucketIdx = data.column.index - 3;
      if (data.section !== "body" || bucketIdx < 0 || bucketIdx >= HISTORY_BUCKETS.length) return;

      const absIdx = data.row.dataIndex ?? data.row.index;
      const rowData = cellData[absIdx]?.[bucketIdx];
      if (!rowData) return;

      // Repaint background using the color autoTable already computed for this cell
      const fc = data.cell.styles.fillColor;
      if (Array.isArray(fc)) {
        doc.setFillColor(...fc);
      } else {
        doc.setFillColor(...BRAND.white);
      }
      doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");

      const bucket = HISTORY_BUCKETS[bucketIdx];
      const { x, y } = data.cell;
      const lineH = 3.6;
      const pad = data.cell.padding("top") || 2;
      rowData.forEach(({ label, p }, i) => {
        doc.setTextColor(...pctColor(p));
        doc.setFontSize(6.5);
        doc.setFont("helvetica", p !== null ? "bold" : "normal");
        const text = bucket.single
          ? (p !== null ? `${p}%` : "—")
          : `${label}: ${p !== null ? `${p}%` : "—"}`;
        doc.text(text, x + (data.cell.padding("left") || 2), y + pad + i * lineH + 2.2);
      });
      doc.setTextColor(...BRAND.ink);
      doc.setFont("helvetica", "normal");
    },
  });

  if (entries.length > 20) {
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.inkLight);
    doc.setFont("helvetica", "italic");
    doc.text(`Showing most recent 20 of ${entries.length} sessions`, 14, doc.lastAutoTable.finalY + 5);
  }

  // ── BED DETAIL PAGE (if any sessions have per-bed data) ──────────────────
  const bedEntries = [...entries].reverse().filter(e => e.bed_data && e.bed_data.length > 0).slice(0, 10);
  if (bedEntries.length > 0) {
    doc.addPage();
    addHeader(doc, 4, totalPages, preparedBy, brandHeader);

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

    // Flatten all beds from all bed-entry sessions into one table
    const bedRows = [];
    bedEntries.forEach(e => {
      const dateStr = e.created_at
        ? new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : e.date;
      e.bed_data.forEach((bed, idx) => {
        if (bed.na) {
          bedRows.push([dateStr, e.hospital || "—", e.location || "—", String(idx + 1), bed.room || String(idx + 1),
            ...summaryMetrics.map(() => "N/A")]);
        } else {
          bedRows.push([
            dateStr, e.hospital || "—", e.location || "—", String(idx + 1), bed.room || String(idx + 1),
            ...summaryMetrics.map(m => {
              if (bed[`${m.id}_na`]) return "N/A";
              const a = bed[`${m.id}_a`];
              if (a === "1" || a === 1) return "YES";
              if (a === "0" || a === 0) return "NO";
              return "—";
            }),
          ]);
        }
      });
    });

    const bedHead = [["Date", "Hospital", "Location", "Bed", "Room",
      ...summaryMetrics.map(m => m.label.replace("Turning & Repositioning", "Turning").replace("Matt Applied Properly", "Matt Prop.").replace("Proper Wedge Offloading", "Offloading").replace("Air Supply in Room", "Air Supply").replace("Wedges in Room", "Wdg Room").replace("Wedges Applied", "Wdg App.").replace("Matt Applied", "Matt App.").replace("Air Used to Reposition Patient", "Air Repos.").replace("Heel Boots", "Heel Boots").replace("Turn Clock", "Trn Clock"))]];

    // Build color lookup for bed rows
    const bedColorData = [];
    bedEntries.forEach(e => {
      e.bed_data.forEach((bed) => {
        if (bed.na) {
          bedColorData.push(summaryMetrics.map(() => null));
        } else {
          bedColorData.push(summaryMetrics.map(m => {
            if (bed[`${m.id}_na`]) return "na";
            const a = bed[`${m.id}_a`];
            if (a === "1" || a === 1) return "yes";
            if (a === "0" || a === 0) return "no";
            return null;
          }));
        }
      });
    });

    // Dynamic metric column widths: 18+22+16+8+12 = 76mm fixed, remaining split among metrics
    const bedFixedW = 76;
    const bedMetricW = Math.floor((182 - bedFixedW) / summaryMetrics.length);
    const bedMetricColStyles = Object.fromEntries(summaryMetrics.map((_, i) => [i + 5, { cellWidth: bedMetricW }]));

    const BED_METRIC_OFFSET = 5;

    autoTable(doc, {
      startY: 48,
      head: bedHead,
      body: bedRows,
      styles: { fontSize: 6, cellPadding: 1.5, font: "helvetica", valign: "middle", fillColor: BRAND.white },
      headStyles: { fillColor: brandHeader, textColor: BRAND.white, fontStyle: "bold", fontSize: 6 },
      alternateRowStyles: { fillColor: [240, 237, 234] },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 22 }, 2: { cellWidth: 16 },
        3: { cellWidth: 8 },  4: { cellWidth: 12 },
        ...bedMetricColStyles,
      },
      margin: { left: 14, right: 14 },
      theme: "plain",
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index < BED_METRIC_OFFSET) return;
        const absIdx = data.row.dataIndex ?? data.row.index;
        const mIdx = data.column.index - BED_METRIC_OFFSET;
        if (mIdx >= summaryMetrics.length) return;
        const pVal = bedColorData[absIdx]?.[mIdx];
        const fc = data.cell.styles.fillColor;
        // Background fill
        const bgColor = pVal === "yes" ? [232, 244, 238] : pVal === "no" ? [253, 240, 240] : Array.isArray(fc) ? fc : BRAND.white;
        doc.setFillColor(...bgColor);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
        // Text color and weight
        if (pVal === "yes") {
          doc.setTextColor(...BRAND.green);
          doc.setFont("helvetica", "bold");
        } else if (pVal === "no") {
          doc.setTextColor(...BRAND.red);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(...BRAND.inkLight);
          doc.setFont("helvetica", "normal");
        }
        doc.setFontSize(6);
        const textVal = data.cell.raw || "";
        doc.text(String(textVal), data.cell.x + (data.cell.padding("left") || 1.5), data.cell.y + data.cell.height / 2 + 1.5, { align: "left" });
        doc.setTextColor(...BRAND.ink);
        doc.setFont("helvetica", "normal");
      },
    });
  }

  // ── PAGE 4/5: HOSPITAL COMPARISON (if multiple) ───────────────────────────
  let pageNum = hasBedData ? 5 : 4;
  if (hospitals.length > 1) {
    doc.addPage();
    addHeader(doc, pageNum, totalPages, preparedBy, brandHeader);
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
      const hMetrics = getMetrics(h);
      return {
        hospital: h,
        sessions: hEntries.length,
        metrics: summaryMetrics.map(m => {
          if (!hMetrics.find(x => x.id === m.id)) return null;
          const vals = hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null);
          return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        }),
        overall: (() => {
          const vals = hMetrics.flatMap(m => hEntries.map(e => pct(e[`${m.id}_num`], e[`${m.id}_den`])).filter(v => v !== null));
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
      doc.text(hLines, cx + hCardW / 2, 50, { align: "center" });
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
    const compRows = summaryMetrics.map(m => [
      m.label,
      ...hospitalData.map(h => h.metrics[summaryMetrics.indexOf(m)] !== null ? `${h.metrics[summaryMetrics.indexOf(m)]}%` : "—")
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
    addHeader(doc, pageNum, totalPages, preparedBy, brandHeader);

    doc.setFillColor(...BRAND.bg);
    doc.rect(0, 14, 210, 283, "F");

    doc.setTextColor(...brandHeader);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("AI CLINICAL ANALYSIS", 14, 24);

    doc.setTextColor(...BRAND.ink);
    doc.setFontSize(20);
    doc.text("Clinical Insights", 14, 35);

    // Strip markdown bold/italic markers and clean up text
    const cleanSummary = summary
      .replace(/\*\*([^*]+)\*\*/g, "$1")  // **bold** → plain
      .replace(/\*([^*]+)\*/g, "$1")       // *italic* → plain
      .replace(/#{1,6}\s+/g, "")           // ## headings → plain
      .replace(/^\s*[-•]\s+/gm, "- ")      // normalise bullets
      .trim();

    // Render summary with multi-page support
    const cardX = 14, cardW = 182, textX = 22, textW = 166;
    const lineHeight = 5;
    const fontSize = 8.5;
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    const allLines = doc.splitTextToSize(cleanSummary, textW);

    // Draw card and accent bar on first page, then paginate
    let currentY = 62;
    let linesPerPage = Math.floor((255 - currentY) / lineHeight); // ~255 is bottom margin
    let pageLines = allLines.slice(0, linesPerPage);
    let remaining = allLines.slice(linesPerPage);

    // First page card
    const firstCardH = Math.min(220, pageLines.length * lineHeight + 20);
    doc.setFillColor(...BRAND.white);
    doc.roundedRect(cardX, 42, cardW, firstCardH, 3, 3, "F");
    doc.setFillColor(...brandHeader);
    doc.rect(cardX, 42, 4, firstCardH, "F");

    doc.setTextColor(...brandHeader);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("AI CLINICAL ANALYSIS", textX, 52);

    doc.setTextColor(...BRAND.inkLight);
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.text(pageLines, textX, currentY);

    // Overflow pages
    while (remaining.length > 0) {
      doc.addPage();
      addHeader(doc, ++pageNum, totalPages, preparedBy, brandHeader);
      doc.setFillColor(...BRAND.bg);
      doc.rect(0, 14, 210, 283, "F");

      linesPerPage = Math.floor((255 - 30) / lineHeight);
      pageLines = remaining.slice(0, linesPerPage);
      remaining = remaining.slice(linesPerPage);

      const overCardH = Math.min(240, pageLines.length * lineHeight + 20);
      doc.setFillColor(...BRAND.white);
      doc.roundedRect(cardX, 24, cardW, overCardH, 3, 3, "F");
      doc.setFillColor(...brandHeader);
      doc.rect(cardX, 24, 4, overCardH, "F");

      doc.setTextColor(...BRAND.inkLight);
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      doc.text(pageLines, textX, 34);
    }

  }

  if (returnBase64) {
    return doc.output("datauristring").split(",")[1];
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const hospitalSlug = hospitalFilter && hospitalFilter !== "All" ? "_" + hospitalFilter.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_") : "";
  doc.save(`CareTrack_Report${hospitalSlug}_${dateStr}.pdf`);
}

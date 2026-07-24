// generateAssessmentPdf.js — Product assessment report
//
// Each product is a two-column block: the protocol it is indicated under
// beside the workflow it is actually used in. These are complementary
// attributes, not a before/after pair — protocol is the clinical trigger
// ("Braden 18 or less"), practice is the application ("use for offloading").
// Do not compare them for equality; they are answering different questions.

import jsPDF from "jspdf";

const BRAND = {
  primary:   [79, 110, 119],   // teal  #4F6E77
  accent:    [124, 83, 102],   // berry #7C5366
  ink:       [42, 38, 36],
  inkMid:    [110, 102, 99],
  inkLight:  [150, 143, 140],
  rule:      [222, 218, 217],
  wash:      [245, 243, 241],
  white:     [255, 255, 255],
};

// ── WinAnsi safety net ───────────────────────────────────────────────────────
// jsPDF's built-in Helvetica encodes WinAnsi only. A single character outside
// it forces the WHOLE string to 2-byte UTF-16, which renders as mojibake
// (see the "%2& &I&m&p&r&o&v&e&d" bug in generatePdf.js). Free-text fields
// pasted from Word routinely carry smart quotes, arrows and dashes, so
// everything user-entered goes through this.
const GLYPHS = {
  "\u2192": " to ", "\u2190": " from ", "\u2194": " to ",
  "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
  "\u2022": "-", "\u2026": "...", "\u2013": "-", "\u2014": "-",
  "\u00a0": " ", "\u2265": ">=", "\u2264": "<=",
};
const safe = (s) =>
  String(s ?? "")
    .replace(/[\u2192\u2190\u2194\u2018\u2019\u201c\u201d\u2022\u2026\u2013\u2014\u00a0\u2265\u2264]/g, (c) => GLYPHS[c])
    .replace(/[^\x00-\xFF]/g, "")
    .replace(/[ \t]{2,}/g, " ");

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y) return safe(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US",
    { month: "short", day: "numeric", year: "numeric" });
};

// Fetch an image URL into a data URL so jsPDF can embed it.
const loadImage = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const MAX = 520;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve({ data: c.toDataURL("image/jpeg", 0.8), w: c.width, h: c.height });
    } catch { resolve(null); }   // tainted canvas
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

export async function generateAssessmentPdf(assessments = [], label = "", preparedBy = "") {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, PH = 297, M = 16;
  const CW = PW - M * 2;

  let page = 1;
  const header = () => {
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, PW, 22, "F");
    doc.setTextColor(...BRAND.white);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("HOVERTECH", M, 10);
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.text("an Etac Company", M, 15);
    doc.setFontSize(7.5);
    doc.text("CARETRACK - PRODUCT ASSESSMENT", PW / 2, 12.5, { align: "center" });
    doc.text(`Page ${page}`, PW - M, 12.5, { align: "right" });
  };

  const footer = () => {
    doc.setDrawColor(...BRAND.rule).setLineWidth(0.2);
    doc.line(M, PH - 14, PW - M, PH - 14);
    doc.setTextColor(...BRAND.inkLight).setFont("helvetica", "normal").setFontSize(7);
    doc.text(safe(`Generated ${new Date().toLocaleDateString("en-US",
      { month: "long", day: "numeric", year: "numeric" })}${preparedBy ? ` - ${preparedBy}` : ""}`),
      M, PH - 9);
  };

  let y = 0;
  const newPage = () => { doc.addPage(); page++; header(); footer(); y = 34; };

  const need = (mm) => { if (y + mm > PH - 20) newPage(); };

  header(); footer();
  y = 34;

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.setTextColor(...BRAND.primary).setFont("helvetica", "bold").setFontSize(8);
  doc.text("PRODUCT ASSESSMENT", M, y);
  y += 9;
  doc.setTextColor(...BRAND.ink).setFont("helvetica", "bold").setFontSize(22);
  doc.text(safe(label || "All accounts"), M, y);
  y += 8;

  const totalProducts = assessments.reduce(
    (n, a) => n + (Array.isArray(a.product_data) ? a.product_data.length : 0), 0);
  doc.setTextColor(...BRAND.inkMid).setFont("helvetica", "normal").setFontSize(10);
  // \u00b7 (middle dot) is WinAnsi 0xB7, so Helvetica encodes it safely.
  doc.text(safe(`${assessments.length} assessment${assessments.length === 1 ? "" : "s"} \u00b7 ` +
                `${totalProducts} product${totalProducts === 1 ? "" : "s"}`), M, y);
  y += 12;

  // ── Per-assessment blocks ──────────────────────────────────────────────────
  for (const a of assessments) {
    const products = Array.isArray(a.product_data) ? a.product_data : [];
    need(26);

    doc.setFillColor(...BRAND.wash);
    doc.rect(M, y - 5, CW, 14, "F");
    doc.setTextColor(...BRAND.ink).setFont("helvetica", "bold").setFontSize(11);
    doc.text(safe(a.hospital || "Unknown hospital"), M + 4, y + 1);
    doc.setTextColor(...BRAND.inkMid).setFont("helvetica", "normal").setFontSize(8);
    doc.text(safe([a.location, fmtDate(a.date), a.logged_by].filter(Boolean).join("  -  ")),
      M + 4, y + 6);
    y += 16;

    if (a.notes) {
      doc.setTextColor(...BRAND.inkMid).setFont("helvetica", "italic").setFontSize(8.5);
      const nl = doc.splitTextToSize(safe(a.notes), CW - 4);
      need(nl.length * 4 + 4);
      doc.text(nl, M + 2, y);
      y += nl.length * 4 + 4;
    }

    for (const p of products) {
      const protocol = safe(p.protocol_for_use || "");
      const practice = safe(p.current_practice_workflow || "");
      const partNo   = safe(p.part_number || "");
      const hospNo   = safe(p.hospital_item_number || "");

      const colW = (CW - 8) / 2;
      const colX = [M, M + colW + 8];

      // Identifier row is single-line; the usage row grows with its content.
      const idH = 13;
      const pLines = doc.splitTextToSize(protocol || "Not recorded", colW - 6);
      const cLines = doc.splitTextToSize(practice || "Not recorded", colW - 6);
      const useH = Math.max(pLines.length, cLines.length) * 4.2 + 12;

      const photos = Array.isArray(p.photos) ? p.photos.slice(0, 3) : [];
      const photoH = photos.length ? 30 : 0;

      need(idH + useH + photoH + 18);

      doc.setTextColor(...BRAND.ink).setFont("helvetica", "bold").setFontSize(10);
      doc.text(safe(p.product || "Unnamed product"), M, y);
      y += 5;

      // All four fields share one box treatment: label above, value below.
      const box = (x, yy, h, label, labelColor, textLines, filled) => {
        doc.setDrawColor(...BRAND.rule).setLineWidth(0.2);
        doc.rect(x, yy, colW, h);
        doc.setTextColor(...labelColor).setFont("helvetica", "bold").setFontSize(6.5);
        doc.text(label, x + 3, yy + 5);
        doc.setFont("helvetica", "normal").setFontSize(8.5);
        doc.setTextColor(...(filled ? BRAND.ink : BRAND.inkLight));
        doc.text(textLines, x + 3, yy + 10);
      };

      const idY = y;
      box(colX[0], idY, idH, "PART NUMBER",          BRAND.inkMid, [partNo || "Not recorded"], !!partNo);
      box(colX[1], idY, idH, "HOSPITAL ITEM NUMBER", BRAND.inkMid, [hospNo || "Not recorded"], !!hospNo);

      const useY = idY + idH + 3;
      box(colX[0], useY, useH, "PROTOCOL FOR USE", BRAND.primary, pLines, !!protocol);
      box(colX[1], useY, useH, "CURRENT PRACTICE", BRAND.accent,  cLines, !!practice);

      y = useY + useH + 5;

      // photos
      if (photos.length) {
        let px = M;
        for (const url of photos) {
          const img = await loadImage(url);
          if (!img) continue;
          const h = 26, w = Math.min(38, (img.w / img.h) * h);
          doc.addImage(img.data, "JPEG", px, y, w, h);
          px += w + 3;
        }
        y += 30;
      }

      y += 4;
      doc.setDrawColor(...BRAND.rule).setLineWidth(0.1);
      doc.line(M, y - 2, PW - M, y - 2);
      y += 3;
    }

    y += 6;
  }

  const safeLabel = (label || "CareTrack").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  doc.save(`CareTrack_Assessment_${safeLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

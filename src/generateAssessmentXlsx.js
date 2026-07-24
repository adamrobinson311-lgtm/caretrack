// generateAssessmentXlsx.js — Product assessment export
//
// One row per PRODUCT, not per assessment. A unit walk that covers six
// products produces six rows, so the sheet can be filtered and pivoted on
// part number without unpacking anything.

import * as XLSX from "xlsx";

const fmtDate = (iso) => {
  // Plain calendar string. new Date(iso) would parse as UTC midnight and
  // render as the previous day in Eastern.
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${m}/${d}/${y}`;
};

export function generateAssessmentXlsx(assessments = [], label = "") {
  const rows = [];

  for (const a of assessments) {
    const products = Array.isArray(a.product_data) ? a.product_data : [];
    if (!products.length) {
      rows.push({
        Date: fmtDate(a.date),
        Hospital: a.hospital || "",
        Unit: a.location || "",
        "Logged By": a.logged_by || "",
        Product: "",
        "Part Number": "",
        "Protocol For Use": "",
        "Current Practice Workflow": "",
        "Gap": "",
        Photos: 0,
        "Visit Notes": a.notes || "",
      });
      continue;
    }
    for (const p of products) {
      const protocol = (p.protocol_for_use || "").trim();
      const practice = (p.current_practice_workflow || "").trim();
      rows.push({
        Date: fmtDate(a.date),
        Hospital: a.hospital || "",
        Unit: a.location || "",
        "Logged By": a.logged_by || "",
        Product: p.product || "",
        "Part Number": p.part_number || "",
        "Protocol For Use": protocol,
        "Current Practice Workflow": practice,
        // Flag rows where both are recorded and differ — the finding worth
        // acting on. Blank when either side wasn't captured, rather than
        // implying a gap that wasn't actually observed.
        "Gap": !protocol || !practice ? "" : (protocol === practice ? "No" : "Yes"),
        Photos: Array.isArray(p.photos) ? p.photos.length : 0,
        "Visit Notes": a.notes || "",
      });
    }
  }

  if (!rows.length) rows.push({ Date: "", Hospital: "", Unit: "", "Logged By": "", Product: "",
    "Part Number": "", "Protocol For Use": "", "Current Practice Workflow": "", "Gap": "",
    Photos: 0, "Visit Notes": "" });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 11 },  // Date
    { wch: 30 },  // Hospital
    { wch: 16 },  // Unit
    { wch: 22 },  // Logged By
    { wch: 26 },  // Product
    { wch: 16 },  // Part Number
    { wch: 46 },  // Protocol
    { wch: 46 },  // Current Practice
    { wch: 7 },   // Gap
    { wch: 8 },   // Photos
    { wch: 34 },  // Visit Notes
  ];

  // Freeze the header. SheetJS wants these as strings.
  ws["!freeze"] = { xSplit: "0", ySplit: "1", topLeftCell: "A2", activePane: "bottomLeft" };
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 10, r: rows.length } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assessments");

  const safeLabel = (label || "CareTrack").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `CareTrack_Assessment_${safeLabel}_${stamp}.xlsx`);
}

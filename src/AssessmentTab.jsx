// AssessmentTab.jsx — Product assessment logging
//
// Follows the Log Audit methodology, but enumerates PRODUCTS per unit rather
// than beds/rooms. Each product records its part number, the protocol it is
// used under, the workflow actually in practice today, and up to 3 photos.
// The protocol/practice pair is the point: the gap between them is the
// finding a rep is there to surface.
//
// Writes to public.assessments — deliberately NOT public.sessions. Every
// report in the system selects from sessions with no type discriminator, so
// assessment rows there would silently inflate compliance denominators.
//
// Props (all from App.jsx, which owns this state):
//   C, userName, hospitals, entries, HospitalInput, UnitInput, isMobile

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { generateAssessmentPdf } from "./generateAssessmentPdf";
import { generateAssessmentXlsx } from "./generateAssessmentXlsx";

// PostgREST caps every unbounded .select() at 1,000 rows with no error.
// assessments is small today; sessions was too, once. Paginating from day one
// costs nothing and removes a bug that only appears at scale.
const fetchAllRows = async (table, columns = "*", build = (q) => q) => {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(supabase.from(table).select(columns))
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
};

const MAX_PHOTOS = 3;

const newProduct = () => ({
  uid: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
  product: "",
  part_number: "",
  protocol_for_use: "",          // what the protocol says to do
  current_practice_workflow: "", // what the unit actually does
  photos: [],                    // uploaded URLs
  _staged: [],                   // File objects awaiting upload
});

const todayIso = () => {
  // Local calendar date. new Date().toISOString() would give UTC and land on
  // the wrong day for anyone east of UTC or after 8pm Eastern.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Mirrors App.jsx compressPhoto — 1200px max edge, 0.82 JPEG
const compressPhoto = (file) => new Promise((resolve) => {
  const MAX = 1200, QUALITY = 0.82;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(b => resolve(b || file), "image/jpeg", QUALITY);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

export default function AssessmentTab({ C, userName, hospitals = [], entries = [], HospitalInput, UnitInput }) {
  const [form, setForm] = useState({ date: todayIso(), hospital: "", location: "", notes: "" });
  const [products, setProducts] = useState([newProduct()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [dupWarning, setDupWarning] = useState(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileRefs = useRef({});

  const [view, setView] = useState("log");        // "log" | "history"
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState("");

  // ── Styles (match CareTrack conventions) ─────────────────────────────────
  const mono = { fontFamily: "'IBM Plex Mono', monospace" };
  const labelStyle = { display: "block", fontSize: 10, ...mono, color: C.inkLight, letterSpacing: "0.08em", marginBottom: 6 };
  const inputStyle = {
    width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 6,
    border: `1px solid ${C.border}`, background: C.surface, color: C.ink,
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const cardStyle = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: 16, marginBottom: 12,
  };

  // ── Duplicate detection ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!form.hospital || !form.location || !form.date) return setDupWarning(null);
      const { data } = await supabase
        .from("assessments")
        .select("id, logged_by")
        .eq("hospital", form.hospital)
        .eq("location", form.location)
        .eq("date", form.date)
        .limit(1);
      if (!cancelled) setDupWarning(data?.length ? data[0] : null);
    };
    check();
    return () => { cancelled = true; };
  }, [form.hospital, form.location, form.date]);

  // ── Protocol recall ──────────────────────────────────────────────────────
  // Typed once for a hospital + part number, pre-filled for everyone after.
  // Server-side rather than localStorage so it survives a new device or a
  // different rep covering the account.
  const recallProtocol = async (idx, partNumber) => {
    if (!form.hospital || !partNumber.trim()) return;
    const { data } = await supabase
      .from("product_protocols")
      .select("protocol_for_use, product")
      .eq("hospital", form.hospital)
      .eq("part_number", partNumber.trim())
      .maybeSingle();
    if (!data) return;
    setProducts(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      return {
        ...p,
        protocol_for_use: p.protocol_for_use || data.protocol_for_use || "",
        product: p.product || data.product || "",
      };
    }));
  };

  const update = (idx, patch) =>
    setProducts(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const addProduct = () => setProducts(prev => [...prev, newProduct()]);
  const removeProduct = (idx) =>
    setProducts(prev => (prev.length === 1 ? [newProduct()] : prev.filter((_, i) => i !== idx)));

  const stagePhotos = (idx, fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setProducts(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const room = MAX_PHOTOS - (p.photos.length + p._staged.length);
      return room <= 0 ? p : { ...p, _staged: [...p._staged, ...incoming.slice(0, room)] };
    }));
  };

  const unstagePhoto = (idx, sIdx) =>
    setProducts(prev => prev.map((p, i) =>
      i === idx ? { ...p, _staged: p._staged.filter((_, j) => j !== sIdx) } : p));

  // ── Save ─────────────────────────────────────────────────────────────────
  const validProducts = products.filter(p => p.product.trim() || p.part_number.trim());
  const canSave = form.hospital && form.location && form.date && validProducts.length > 0 && !saving;

  const handleSave = async () => {
    setError(""); setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;

      // Insert first — photo storage paths are keyed on the assessment id.
      const payload = {
        date: form.date,
        hospital: form.hospital,
        location: form.location || null,
        notes: form.notes || null,
        logged_by: userName,
        user_id: userId,
        product_data: validProducts.map(({ uid, _staged, ...rest }) => rest),
      };

      const { data: inserted, error: insErr } = await supabase
        .from("assessments").insert([payload]).select().single();
      if (insErr) throw insErr;

      // Upload staged photos, then write the URLs back.
      const withPhotos = [];
      let anyPhotos = false;
      for (let i = 0; i < validProducts.length; i++) {
        const p = validProducts[i];
        const urls = [...p.photos];
        if (p._staged.length) {
          anyPhotos = true;
          setUploadingCount(c => c + p._staged.length);
          for (const file of p._staged) {
            const compressed = await compressPhoto(file);
            const path = `${inserted.id}/${i}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("assessment-photos")
              .upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
            if (!upErr) {
              const { data: pub } = supabase.storage.from("assessment-photos").getPublicUrl(path);
              urls.push(pub.publicUrl);
            }
            setUploadingCount(c => Math.max(0, c - 1));
          }
        }
        const { uid, _staged, ...rest } = p;
        withPhotos.push({ ...rest, photos: urls });
      }

      if (anyPhotos) {
        await supabase.from("assessments").update({ product_data: withPhotos }).eq("id", inserted.id);
      }

      // Remember each protocol for next time.
      for (const p of withPhotos) {
        if (p.part_number?.trim() && p.protocol_for_use?.trim()) {
          await supabase.from("product_protocols").upsert({
            hospital: form.hospital,
            part_number: p.part_number.trim(),
            product: p.product || null,
            protocol_for_use: p.protocol_for_use,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          }, { onConflict: "hospital,part_number" });
        }
      }

      setForm({ date: todayIso(), hospital: "", location: "", notes: "" });
      setProducts([newProduct()]);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      console.error("Assessment save failed:", err);
      setError(err?.message || "Could not save this assessment. Check your connection and try again.");
    } finally {
      setSaving(false);
      setUploadingCount(0);
    }
  };

  // ── History ──────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    setLoadingHistory(true); setHistoryError("");
    try {
      // RLS scopes this to the caller's own rows, or everything for admins.
      setHistory(await fetchAllRows("assessments"));
    } catch (err) {
      console.error("Assessment history failed:", err);
      setHistoryError("Could not load assessments. Check your connection and try again.");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { if (view === "history") loadHistory(); /* eslint-disable-next-line */ }, [view]);

  const hasGap = (p) => {
    const a = (p.protocol_for_use || "").trim(), b = (p.current_practice_workflow || "").trim();
    return !!a && !!b && a !== b;
  };

  const exportLabel = () => {
    const set = [...new Set(history.map(h => h.hospital).filter(Boolean))];
    return set.length === 1 ? set[0] : "All accounts";
  };

  const runExport = async (kind) => {
    if (!history.length) return;
    setExporting(kind);
    try {
      if (kind === "pdf") await generateAssessmentPdf(history, exportLabel(), userName);
      else generateAssessmentXlsx(history, exportLabel());
    } catch (err) {
      console.error("Assessment export failed:", err);
      setHistoryError("Export failed. Try again, or reload the page if it persists.");
    } finally {
      setExporting("");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, ...mono, color: C.inkLight, letterSpacing: "0.08em", marginBottom: 4 }}>
          PRODUCT ASSESSMENT
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.ink }}>Log an assessment</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: C.inkMid }}>
          Record each product in the unit, its part number, and the protocol it is used under.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[["log", "LOG"], ["history", "HISTORY"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setView(id)}
            style={{
              padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 11, ...mono,
              letterSpacing: "0.06em",
              border: `1px solid ${view === id ? C.primary : C.border}`,
              background: view === id ? C.primary : "none",
              color: view === id ? "#fff" : C.inkMid,
            }}>{lbl}</button>
        ))}
      </div>

      {view === "history" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => runExport("pdf")} disabled={!history.length || !!exporting}
              style={{ flex: "1 1 120px", padding: "10px", borderRadius: 6, fontSize: 11, ...mono,
                       letterSpacing: "0.05em", cursor: history.length ? "pointer" : "not-allowed",
                       border: `1px solid ${C.border}`, background: C.surface,
                       color: history.length ? C.primary : C.inkLight }}>
              {exporting === "pdf" ? "BUILDING..." : "EXPORT PDF"}
            </button>
            <button onClick={() => runExport("xlsx")} disabled={!history.length || !!exporting}
              style={{ flex: "1 1 120px", padding: "10px", borderRadius: 6, fontSize: 11, ...mono,
                       letterSpacing: "0.05em", cursor: history.length ? "pointer" : "not-allowed",
                       border: `1px solid ${C.border}`, background: C.surface,
                       color: history.length ? C.primary : C.inkLight }}>
              {exporting === "xlsx" ? "BUILDING..." : "EXPORT EXCEL"}
            </button>
          </div>

          {historyError && (
            <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 6,
                          background: "#9E3A3A15", border: "1px solid #9E3A3A44", fontSize: 13, color: C.ink }}>
              {historyError}
            </div>
          )}

          {loadingHistory && (
            <p style={{ fontSize: 13, color: C.inkMid, textAlign: "center", padding: 24 }}>Loading assessments...</p>
          )}

          {!loadingHistory && !history.length && !historyError && (
            <div style={{ ...cardStyle, textAlign: "center", padding: 32 }}>
              <p style={{ margin: 0, fontSize: 14, color: C.ink }}>No assessments logged yet.</p>
              <p style={{ margin: "6px 0 14px", fontSize: 13, color: C.inkMid }}>
                Walk a unit and record the products you find.
              </p>
              <button onClick={() => setView("log")}
                style={{ padding: "10px 18px", borderRadius: 6, border: "none", background: C.primary,
                         color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Log an assessment
              </button>
            </div>
          )}

          {!loadingHistory && history.map(a => {
            const products = Array.isArray(a.product_data) ? a.product_data : [];
            const gapCount = products.filter(hasGap).length;
            const open = expanded === a.id;
            return (
              <div key={a.id} style={cardStyle}>
                <button onClick={() => setExpanded(open ? null : a.id)}
                  style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{a.hospital}</div>
                      <div style={{ fontSize: 11, ...mono, color: C.inkLight, marginTop: 3 }}>
                        {[a.location, a.date, a.logged_by].filter(Boolean).join("  ·  ")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, ...mono, color: C.inkMid }}>
                        {products.length} product{products.length === 1 ? "" : "s"}
                      </div>
                      {gapCount > 0 && (
                        <div style={{ fontSize: 10, ...mono, color: "#9E3A3A", marginTop: 3 }}>
                          {gapCount} gap{gapCount === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {open && (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    {a.notes && (
                      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.inkMid, fontStyle: "italic" }}>{a.notes}</p>
                    )}
                    {products.map((p, i) => (
                      <div key={i} style={{ marginBottom: 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{p.product || "Unnamed product"}</span>
                          {p.part_number && (
                            <span style={{ fontSize: 11, ...mono, color: C.inkLight }}>{p.part_number}</span>
                          )}
                        </div>
                        {hasGap(p) && (
                          <span style={{ display: "inline-block", marginTop: 5, padding: "2px 7px", borderRadius: 3,
                                         background: "#9E3A3A", color: "#fff", fontSize: 9, ...mono, letterSpacing: "0.06em" }}>
                            GAP
                          </span>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                          <div style={{ padding: 10, borderRadius: 6, border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 9, ...mono, color: C.primary, letterSpacing: "0.06em", marginBottom: 5 }}>PROTOCOL FOR USE</div>
                            <div style={{ fontSize: 12, color: p.protocol_for_use ? C.ink : C.inkLight }}>
                              {p.protocol_for_use || "Not recorded"}
                            </div>
                          </div>
                          <div style={{ padding: 10, borderRadius: 6, border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 9, ...mono, color: C.accent || "#7C5366", letterSpacing: "0.06em", marginBottom: 5 }}>CURRENT PRACTICE</div>
                            <div style={{ fontSize: 12, color: p.current_practice_workflow ? C.ink : C.inkLight }}>
                              {p.current_practice_workflow || "Not recorded"}
                            </div>
                          </div>
                        </div>
                        {Array.isArray(p.photos) && p.photos.length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                            {p.photos.map((url, j) => (
                              <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`${p.product || "Product"} photo ${j + 1}`}
                                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "log" && (
      <>

      {/* Visit details */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>DATE</label>
            <input type="date" value={form.date} max={todayIso()}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>HOSPITAL</label>
            {HospitalInput
              ? <HospitalInput value={form.hospital} hospitals={hospitals} entries={entries}
                  onChange={val => setForm(f => ({ ...f, hospital: val, location: "" }))} />
              : <input value={form.hospital} onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))} style={inputStyle} />}
          </div>
          <div>
            <label style={labelStyle}>UNIT</label>
            {UnitInput
              ? <UnitInput value={form.location} hospital={form.hospital}
                  onChange={val => setForm(f => ({ ...f, location: val }))} />
              : <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} />}
          </div>
        </div>

        {dupWarning && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: "#8A6A2A15",
                        border: "1px solid #8A6A2A44", fontSize: 12, color: C.ink }}>
            An assessment already exists for this hospital, unit and date
            {dupWarning.logged_by ? ` — logged by ${dupWarning.logged_by}` : ""}. Saving creates a second one.
          </div>
        )}
      </div>

      {/* Products */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "22px 0 10px" }}>
        <div style={{ fontSize: 10, ...mono, color: C.inkLight, letterSpacing: "0.08em" }}>
          PRODUCTS ({products.length})
        </div>
      </div>

      {products.map((p, idx) => {
        const photoCount = p.photos.length + p._staged.length;
        return (
          <div key={p.uid} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, ...mono, color: C.primary, letterSpacing: "0.06em" }}>
                PRODUCT {idx + 1}
              </div>
              <button onClick={() => removeProduct(idx)}
                style={{ background: "none", border: "none", color: C.inkLight, cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1 }}
                aria-label={`Remove product ${idx + 1}`}>✕</button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>PRODUCT</label>
                <input value={p.product} placeholder="e.g. HoverMatt SPU"
                  onChange={e => update(idx, { product: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>PART NUMBER</label>
                <input value={p.part_number} placeholder="e.g. HM34DM"
                  onChange={e => update(idx, { part_number: e.target.value })}
                  onBlur={e => recallProtocol(idx, e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>PROTOCOL FOR USE</label>
                <textarea value={p.protocol_for_use} rows={3}
                  placeholder="What the protocol calls for..."
                  onChange={e => update(idx, { protocol_for_use: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div>
                <label style={labelStyle}>CURRENT PRACTICE WORKFLOW</label>
                <textarea value={p.current_practice_workflow} rows={3}
                  placeholder="What the unit actually does today..."
                  onChange={e => update(idx, { current_practice_workflow: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div>
                <label style={labelStyle}>PHOTOS ({photoCount}/{MAX_PHOTOS})</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p._staged.map((f, sIdx) => (
                    <div key={sIdx} style={{ position: "relative", width: 64, height: 64, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={() => unstagePhoto(idx, sIdx)}
                        style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%",
                                 border: "none", background: "rgba(0,0,0,0.6)", color: "white", fontSize: 11, cursor: "pointer", lineHeight: 1 }}
                        aria-label="Remove photo">✕</button>
                    </div>
                  ))}
                  {photoCount < MAX_PHOTOS && (
                    <>
                      <button onClick={() => fileRefs.current[p.uid]?.click()}
                        style={{ width: 64, height: 64, borderRadius: 6, border: `1px dashed ${C.border}`,
                                 background: "none", color: C.inkLight, fontSize: 20, cursor: "pointer" }}
                        aria-label="Add photo">+</button>
                      <input ref={el => (fileRefs.current[p.uid] = el)} type="file" accept="image/*" capture="environment"
                        multiple style={{ display: "none" }}
                        onChange={e => { stagePhotos(idx, e.target.files); e.target.value = ""; }} />
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })}

      <button onClick={addProduct}
        style={{ width: "100%", padding: "12px", borderRadius: 6, border: `1px dashed ${C.border}`,
                 background: "none", color: C.primary, fontSize: 13, ...mono, letterSpacing: "0.05em",
                 cursor: "pointer", marginBottom: 20 }}>
        + ADD PRODUCT
      </button>

      {error && (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 6,
                      background: "#9E3A3A15", border: "1px solid #9E3A3A44", fontSize: 13, color: C.ink }}>
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={!canSave}
        style={{ width: "100%", padding: "14px", borderRadius: 6, border: "none",
                 background: canSave ? C.primary : C.border, color: canSave ? "#fff" : C.inkLight,
                 fontSize: 14, fontWeight: 600, cursor: canSave ? "pointer" : "not-allowed",
                 letterSpacing: "0.03em" }}>
        {saving
          ? (uploadingCount > 0 ? `Uploading ${uploadingCount} photo${uploadingCount === 1 ? "" : "s"}...` : "Saving...")
          : "Save assessment"}
      </button>

      {saved && (
        <div style={{ marginTop: 14, padding: "12px", borderRadius: 6, textAlign: "center",
                      background: "#3A7D5C15", border: "1px solid #3A7D5C44", fontSize: 13, color: C.ink }}>
          Assessment saved.
        </div>
      )}

      {!validProducts.length && (
        <p style={{ marginTop: 14, fontSize: 12, color: C.inkLight, textAlign: "center" }}>
          Add a product name or part number to save.
        </p>
      )}
      </>
      )}
    </div>
  );
}

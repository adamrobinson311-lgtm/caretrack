// CareTrack Metric Icons
// Usage: import { MetricIcon } from "./MetricIcons";
// <MetricIcon id="matt_applied" size={24} color="#4F6E77" />

export const METRIC_ICONS = {

  // MATT Applied — a mattress/pad with a checkmark layer
  matt_applied: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mattress body */}
      <rect x="2" y="7" width="20" height="10" rx="2.5" stroke={color} strokeWidth="1.6" fill="none"/>
      {/* Quilting lines */}
      <line x1="8" y1="7" x2="8" y2="17" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="16" y1="7" x2="16" y2="17" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1" strokeOpacity="0.4"/>
      {/* Checkmark badge */}
      <circle cx="18.5" cy="6.5" r="4" fill={color}/>
      <polyline points="16.2,6.5 18,8.2 21,5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),

  // Wedges Applied — two wedges side by side with a checkmark badge
  wedges_applied: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 19 L7 10 L12 19 Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M12 19 L17 10 L22 19 Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <line x1="2" y1="19" x2="22" y2="19" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="19" cy="7" r="4" fill={color}/>
      <polyline points="16.8,7 18.5,8.8 21.5,5.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  // Turning & Repositioning — clock face with prominent patient silhouette in foreground
  turning_criteria: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clock circle */}
      <circle cx="12" cy="10" r="8.5" stroke={color} strokeWidth="1.5"/>
      {/* Clock hands */}
      <line x1="12" y1="10" x2="12" y2="5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="12" y1="10" x2="15.5" y2="12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      {/* Clock center dot */}
      <circle cx="12" cy="10" r="1" fill={color}/>
      {/* Patient — white filled to cover clock, making them stand in front */}
      <circle cx="12" cy="17" r="3" fill="white" stroke={color} strokeWidth="1.4"/>
      <path d="M7 24 Q7 21 12 21 Q17 21 17 24" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="white"/>
      {/* Cover line between head and body */}
      <line x1="8.5" y1="20.2" x2="15.5" y2="20.2" stroke="white" strokeWidth="1.5"/>
    </svg>
  ),

  // Matt Applied Properly — horizontal rectangle (MATT pad) with four-way arrow in center + shield badge
  matt_proper: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* MATT pad — long horizontal rectangle, taller */}
      <rect x="1" y="5" width="17" height="14" rx="2" stroke={color} strokeWidth="1.4"/>
      {/* Four-way arrow in center of pad */}
      <line x1="9.5" y1="9" x2="9.5" y2="15" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6.5" y1="12" x2="12.5" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      {/* Up arrow */}
      <polyline points="8.2,10.2 9.5,9 10.8,10.2" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Down arrow */}
      <polyline points="8.2,13.8 9.5,15 10.8,13.8" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Left arrow */}
      <polyline points="7.8,10.7 6.5,12 7.8,13.3" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Right arrow */}
      <polyline points="11.2,10.7 12.5,12 11.2,13.3" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Shield badge for "properly" */}
      <path d="M19 2 L23 4 L23 8 Q23 11.5 19 13 Q15 11.5 15 8 L15 4 Z" stroke={color} strokeWidth="1.3" fill="white" strokeLinejoin="round"/>
      <polyline points="17.2,7.5 18.8,9.2 21.2,5.8" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  // Wedges in Room — location pin containing a wedge shape
  wedges_in_room: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 C8.5 2 6 4.8 6 8 C6 12.5 12 20 12 20 C12 20 18 12.5 18 8 C18 4.8 15.5 2 12 2 Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8.5 10 L12 5.5 L15.5 10 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={color}/>
      <line x1="8.5" y1="10" x2="15.5" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),

  // Proper Wedge Offloading — HoverTech style: heel pad floating above wedge with stop-hand
  // Proper Wedge Offloading — matches HoverTech diagram exactly:
  // Top row: heel circle + long MATT pill pad with inner loop
  // Bottom row: flat rect wedge + stop hand + pointed wedge
  wedge_offload: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* TOP ROW */}
      {/* Heel circle */}
      <circle cx="3.5" cy="5" r="2.2" stroke={color} strokeWidth="1.3"/>
      {/* MATT pad — long pill with inner rounded-end loop */}
      <rect x="7" y="3" width="14" height="4" rx="2" stroke={color} strokeWidth="1.3"/>
      <path d="M18.5 5 Q17 3.6 15.5 5 Q17 6.4 18.5 5" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>

      {/* BOTTOM ROW */}
      {/* Left wedge — pointed left end */}
      <path d="M1 15 L1 17 L8 17 L8 13 Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
      {/* Stop hand — 4 fingers up, palm base */}
      <path d="M10 16.5 L10 14 M11.2 16.5 L11.2 13.5 M12.4 16.5 L12.4 14 M13.6 16.5 L13.6 14.5" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M10 16.5 Q9.5 18 10 18.5 L13.6 18.5 Q14.2 18 13.6 16.5" stroke={color} strokeWidth="1" strokeLinejoin="round"/>
      {/* Right wedge — pointed right end */}
      <path d="M15 13 L15 17 L22 17 L22 15 Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),

  // Air Supply in Room — air/wind waves inside a room with checkmark badge
  air_supply: ({ size = 24, color = "#4F6E77" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Room outline */}
      <path d="M3 20 L3 4 L21 4 L21 20" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <line x1="2" y1="20" x2="22" y2="20" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      {/* Air/wind waves */}
      <path d="M6 10 Q8.5 7.5 11 10 Q13.5 12.5 16 10 Q18.5 7.5 20 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 15 Q8.5 12.5 11 15 Q13.5 17.5 16 15 Q18.5 12.5 20 15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Checkmark badge */}
      <circle cx="19" cy="4" r="4" fill="white"/>
      <circle cx="19" cy="4" r="4" fill={color}/>
      <polyline points="16.8,4 18.5,5.8 21.5,2.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// Convenience component
export const MetricIcon = ({ id, size = 24, color = "#4F6E77" }) => {
  const Icon = METRIC_ICONS[id];
  if (!Icon) return null;
  return <Icon size={size} color={color} />;
};

// Preview all icons (for development/reference)
export default function MetricIconPreview() {
  const metrics = [
    { id: "matt_applied",     label: "Matt Applied" },
    { id: "wedges_applied",   label: "Wedges Applied" },
    { id: "turning_criteria", label: "Turning & Repositioning" },
    { id: "matt_proper",      label: "Matt Applied Properly" },
    { id: "wedges_in_room",   label: "Wedges in Room" },
    { id: "wedge_offload",    label: "Proper Wedge Offloading" },
    { id: "air_supply",       label: "Air Supply in Room" },
  ];

  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      background: "#f5f3f0",
      minHeight: "100vh",
      padding: "40px",
    }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#7C7270", marginBottom: 4 }}>CARETRACK</div>
        <div style={{ fontSize: 20, fontFamily: "'Libre Baskerville', serif", color: "#2a2624", fontWeight: 400 }}>Metric Icons</div>
      </div>

      {/* Grid preview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 48 }}>
        {metrics.map(m => {
          const Icon = METRIC_ICONS[m.id];
          return (
            <div key={m.id} style={{
              background: "white",
              border: "1px solid #e0dbd9",
              borderRadius: 10,
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{
                width: 48, height: 48,
                background: "#e8eff1",
                borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={26} color="#4F6E77" />
              </div>
              <div style={{ fontSize: 10, color: "#4F6E77", letterSpacing: "0.06em", textAlign: "center", lineHeight: 1.5 }}>
                {m.label.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Size variants */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#7C7270", marginBottom: 16 }}>SIZE VARIANTS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {[16, 20, 24, 32, 40].map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <METRIC_ICONS.matt_applied size={s} color="#4F6E77" />
              <span style={{ fontSize: 9, color: "#9c9488" }}>{s}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* Color variants */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#7C7270", marginBottom: 16 }}>COLOR VARIANTS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {[
            { color: "#4F6E77", label: "primary" },
            { color: "#7C5366", label: "accent" },
            { color: "#678093", label: "secondary" },
            { color: "#5a8f5a", label: "green" },
            { color: "#b87c3a", label: "amber" },
          ].map(({ color, label }) => (
            <div key={color} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <METRIC_ICONS.air_supply size={24} color={color} />
              <span style={{ fontSize: 9, color: "#9c9488" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage snippet */}
      <div style={{
        marginTop: 40,
        background: "#2a2624",
        borderRadius: 8,
        padding: "16px 20px",
        fontSize: 11,
        color: "#a8c8d0",
        lineHeight: 1.8,
      }}>
        <div style={{ color: "#7C7270", marginBottom: 8, fontSize: 9, letterSpacing: "0.1em" }}>USAGE</div>
        <div><span style={{ color: "#7C5366" }}>import</span> {"{ MetricIcon }"} <span style={{ color: "#7C5366" }}>from</span> <span style={{ color: "#8fbc8f" }}>"./MetricIcons"</span>;</div>
        <div style={{ marginTop: 8 }}>{"<"}<span style={{ color: "#4F6E77" }}>MetricIcon</span> <span style={{ color: "#c8a87c" }}>id</span>=<span style={{ color: "#8fbc8f" }}>"matt_applied"</span> <span style={{ color: "#c8a87c" }}>size</span>={"{24}"} <span style={{ color: "#c8a87c" }}>color</span>=<span style={{ color: "#8fbc8f" }}>"#4F6E77"</span> {"/>"}</div>
      </div>
    </div>
  );
}

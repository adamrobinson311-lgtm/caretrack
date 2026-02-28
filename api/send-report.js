const { Resend } = require("resend");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, pdfBase64, sessionCount, hospitalFilter, senderName } = req.body;
  if (!to || !pdfBase64) return res.status(400).json({ error: "Missing required fields" });

  const resend = new Resend(process.env.RESEND_API_KEY);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const filterLabel = hospitalFilter && hospitalFilter !== "All" ? ` — ${hospitalFilter}` : "";

  try {
    await resend.emails.send({
      from: "HoverTech CareTrack <onboarding@resend.dev>", // TODO: switch to caretrack@hovertechinternational.com after domain verified
      to,
      subject: `CareTrack Compliance Report${filterLabel} — ${today}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f3f1;">
          <div style="background: #4F6E77; padding: 28px 32px; border-left: 6px solid #7C5366;">
            <div style="font-size: 20px; font-weight: bold; color: white; letter-spacing: 1px;">HOVERTECH</div>
            <div style="font-size: 11px; color: #A8C8D0; font-style: italic;">an Etac Company</div>
            <div style="font-size: 10px; color: #7CA8B4; margin-top: 8px; letter-spacing: 2px;">CARETRACK · WOUND CARE COMPLIANCE</div>
          </div>
          <div style="padding: 32px; background: white;">
            <h2 style="color: #2A2624; font-size: 22px; margin: 0 0 8px;">Compliance Report</h2>
            <p style="color: #7C7270; font-size: 13px; margin: 0 0 24px;">Generated ${today}${filterLabel ? ` · ${filterLabel}` : ""} · ${sessionCount} sessions</p>
            <p style="color: #4F6E77; font-size: 14px; margin: 0 0 16px;">Hi${senderName ? ` ${senderName}` : ""},</p>
            <p style="color: #5a5448; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
              Please find your HoverTech CareTrack wound care compliance report attached as a PDF.
              ${filterLabel ? `This report covers data for <strong>${filterLabel.replace(" — ", "")}</strong>.` : "This report covers all hospitals."}
            </p>
            <p style="color: #5a5448; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              The report includes compliance metrics, session history, and clinical insights for your review.
            </p>
            <div style="background: #e8eff1; border-left: 3px solid #4F6E77; padding: 14px 18px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
              <div style="font-size: 11px; color: #4F6E77; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px;">SESSIONS INCLUDED</div>
              <div style="font-size: 22px; font-weight: bold; color: #2A2624;">${sessionCount}</div>
            </div>
            <p style="color: #9c9488; font-size: 12px; margin: 0;">
              This report was sent from HoverTech CareTrack. Log in at <a href="https://caretrack-puce.vercel.app" style="color: #4F6E77;">caretrack-puce.vercel.app</a>
            </p>
          </div>
          <div style="background: #DEDAD9; padding: 16px 32px; text-align: center;">
            <div style="font-size: 10px; color: #7C7270;">HoverTech, an Etac Company · CareTrack Wound Care Compliance</div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `CareTrack_Report_${dateStr}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Resend error:", err);
    res.status(500).json({ error: "Failed to send email", detail: err.message });
  }
};

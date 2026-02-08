import { Resend } from "resend";

const STUB_MODE = !process.env.RESEND_API_KEY;

const resend = STUB_MODE ? null : new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; id: string }> {
  try {
    if (STUB_MODE) {
      console.log("[EMAIL STUB]", {
        to,
        subject,
        htmlPreview: html.substring(0, 200),
        timestamp: new Date().toISOString(),
      });
      return { success: true, id: "stub-" + Date.now() };
    }

    const result = await resend!.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "EverySkill <notifications@everyskill.ai>",
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error("[EMAIL ERROR]", result.error);
      return { success: false, id: "" };
    }

    return { success: true, id: result.data?.id || "" };
  } catch (error) {
    console.error("[EMAIL ERROR] Failed to send email:", error);
    return { success: false, id: "" };
  }
}

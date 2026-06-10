import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { sendContactEmail } from "../lib/mailer.js";

const router = Router();

router.post("/contact", async (req, res) => {
  const { name, email, phone, subject, message } = req.body as {
    name?: string; email?: string; phone?: string; subject?: string; message?: string;
  };

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return void res.status(400).json({ error: "Name, email and message are required." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return void res.status(400).json({ error: "Invalid email address." });
  }

  try {
    const [settings] = await db.select({
      supportEmail: appSettingsTable.supportEmail,
      siteName: appSettingsTable.siteName,
    }).from(appSettingsTable).limit(1);

    const toEmail = settings?.supportEmail;
    if (toEmail) {
      await sendContactEmail({
        to: toEmail,
        siteName: settings?.siteName ?? "Shohure",
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() ?? "",
        subject: subject?.trim() ?? "General Inquiry",
        message: message.trim(),
      }).catch(err => {
        console.error("[contact] Failed to send contact email:", err.message);
      });
    } else {
      console.warn("[contact] No support email configured — contact submission not emailed.", {
        name, email, subject,
      });
    }

    return void res.json({ ok: true });
  } catch (err: any) {
    console.error("[contact] Error:", err.message);
    return void res.status(500).json({ error: "Failed to process contact request." });
  }
});

export default router;

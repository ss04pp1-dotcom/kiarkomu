import { db } from "@workspace/db";
import { appConfigTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { safeDecrypt, isEncrypted } from "./crypto.js";

interface EmailCredentials {
  user: string;
  pass: string;
  fromName?: string;
}

async function getAppConfigCredentials(): Promise<EmailCredentials | null> {
  try {
    const [settings] = await db.select().from(appSettingsTable).limit(1);
    if (settings?.smtpEmail && settings?.smtpPassword) {
      let smtpPass: string = settings.smtpPassword;
      if (isEncrypted(smtpPass)) {
        smtpPass = safeDecrypt(smtpPass) ?? smtpPass;
      }
      if (!smtpPass) return null;
      return {
        user: settings.smtpEmail,
        pass: smtpPass,
        fromName: settings.siteName ?? undefined,
      };
    }

    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.id, "mobile")).limit(1);
    if (!row) return null;
    const config = row.config as any;
    const appEmail: string | undefined = config?.appEmail;
    let appPassword: string | undefined = config?.appPassword;
    
    if (!appEmail || !appPassword) return null;
    if (isEncrypted(appPassword)) {
      appPassword = safeDecrypt(appPassword) ?? undefined;
    }
    if (!appEmail || !appPassword) return null;
    
    return { user: appEmail, pass: appPassword };
  } catch (err) {
    console.error("[mailer] Failed to read credentials from DB:", err);
    return null;
  }
}

async function getEmailConfig() {
  let user = process.env["SMTP_USER"];
  let pass = process.env["SMTP_PASS"];
  let fromName = process.env["SMTP_FROM_NAME"] || "Shohure";

  if (!user || !pass) {
    const fromConfig = await getAppConfigCredentials();
    if (fromConfig) {
      user = fromConfig.user;
      pass = fromConfig.pass;
      if (fromConfig.fromName) fromName = fromConfig.fromName;
    }
  }

  if (!user || !pass) {
    throw new Error("Email is not configured. Please add your Brevo API Key in Admin -> Settings -> Email.");
  }

  return {
    user,
    pass, 
    from: process.env["SMTP_FROM"] || user,
    fromName,
  };
}

async function sendBrevoRestEmail(config: any, to: string, subject: string, htmlContent: string) {
  const payload = {
    sender: { name: config.fromName, email: config.from },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": config.pass,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[mailer] Brevo API Error:", errorText);
      throw new Error("Email provider rejected the request.");
    }

    return true;
  } catch (error: any) {
    clearTimeout(timeout);
    console.error("[mailer] Network Error:", error.message);
    throw new Error("Failed to send email due to network/timeout error.");
  }
}

function buildCodeEmail({ siteName, subtitle, bodyText, code, footerNote }: { siteName: string; subtitle: string; bodyText: string; code: string; footerNote: string; }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #eee;">
      <h2 style="color:#E91E63;margin:0 0 8px">${siteName}</h2>
      <p style="color:#555;font-size:15px;margin:0 0 24px">${subtitle}</p>
      <p style="color:#333;font-size:15px;">${bodyText}</p>
      <div style="background:#F3F4F6;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
        <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111;">${code}</span>
      </div>
      <p style="color:#888;font-size:13px;">${footerNote}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:12px;margin:0">&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </div>
  `;
}

export async function sendTestEmail(toEmail: string) {
  const config = await getEmailConfig();
  const subject = `${config.fromName} — Email Integration Successful`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #eee;">
      <h2 style="color:#E91E63;margin:0 0 8px">${config.fromName}</h2>
      <p style="color:#555;font-size:15px;margin:0 0 24px">Brevo REST API configuration test</p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:20px;margin:0 0 24px">
        <p style="color:#166534;font-size:15px;font-weight:600;margin:0 0 12px">&#10003; Your email is configured correctly.</p>
        <p style="color:#374151;font-size:13px;margin:0">Render outbound SMTP blocks have been successfully bypassed using the Brevo REST API.</p>
      </div>
      <p style="color:#888;font-size:13px;">Triggered from Admin Panel -> Settings -> Email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:12px;margin:0">&copy; ${new Date().getFullYear()} ${config.fromName}. All rights reserved.</p>
    </div>
  `;
  await sendBrevoRestEmail(config, toEmail, subject, html);
}

export async function sendPasswordResetEmail(toEmail: string, code: string, siteName?: string) {
  const config = await getEmailConfig();
  const name = siteName ?? config.fromName;
  const subject = `Your ${name} password reset code`;
  const html = buildCodeEmail({
    siteName: name,
    subtitle: "Password reset request",
    bodyText: "Use the code below to reset your password. It expires in <strong>15 minutes</strong>.",
    code,
    footerNote: "If you did not request this, you can safely ignore this email.",
  });
  await sendBrevoRestEmail(config, toEmail, subject, html);
}

export async function sendContactEmail({ to, siteName, name, email, phone, subject, message }: {
  to: string; siteName: string; name: string; email: string; phone: string; subject: string; message: string;
}) {
  const config = await getEmailConfig();
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #eee;">
      <h2 style="color:#F0185A;margin:0 0 4px">${siteName}</h2>
      <p style="color:#555;font-size:14px;margin:0 0 24px">New contact form submission</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr><td style="padding:8px 12px;background:#F9FAFB;font-weight:600;color:#374151;width:110px;border-radius:6px 0 0 6px">Name</td><td style="padding:8px 12px;color:#111827">${name}</td></tr>
        <tr><td style="padding:8px 12px;font-weight:600;color:#374151">Email</td><td style="padding:8px 12px"><a href="mailto:${email}" style="color:#F0185A">${email}</a></td></tr>
        ${phone ? `<tr><td style="padding:8px 12px;background:#F9FAFB;font-weight:600;color:#374151">Phone</td><td style="padding:8px 12px;color:#111827">${phone}</td></tr>` : ""}
        <tr><td style="padding:8px 12px;font-weight:600;color:#374151">Subject</td><td style="padding:8px 12px;color:#111827">${subject}</td></tr>
      </table>
      <div style="background:#F9FAFB;border-radius:8px;padding:16px;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap">${message}</div>
      <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">Reply directly to this email to respond to ${name}.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
      <p style="color:#bbb;font-size:12px;margin:0">&copy; ${new Date().getFullYear()} ${siteName}</p>
    </div>
  `;
  await sendBrevoRestEmail(config, to, `[Contact] ${subject} — from ${name}`, html);
}

export async function sendVerificationEmail(toEmail: string, code: string, siteName?: string) {
  const config = await getEmailConfig();
  const name = siteName ?? config.fromName;
  const subject = `Verify your ${name} account`;
  const html = buildCodeEmail({
    siteName: name,
    subtitle: "Account email verification",
    bodyText: "Use the code below to verify your email address. It expires in <strong>15 minutes</strong>.",
    code,
    footerNote: "If you did not try to create an account, you can safely ignore this email.",
  });
  await sendBrevoRestEmail(config, toEmail, subject, html);
}
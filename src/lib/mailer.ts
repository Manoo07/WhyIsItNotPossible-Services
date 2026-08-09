import nodemailer, { type Transporter } from "nodemailer";

// Lazy, same pattern as lib/s3.ts and lib/redis.ts: throws only when a send
// is actually attempted, so the rest of the app keeps working without SMTP
// configured. The notification worker catches this and marks the
// notification FAILED (retryable) instead of crashing.
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !port || !user || !pass) {
      throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS must be set to send email.");
    }
    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM must be set to send email.");
  }
  await getTransporter().sendMail({ from, to, subject, html, text });
}

/**
 * Email sending abstraction using Nodemailer.
 * Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env to enable real delivery.
 * Without SMTP config, emails are logged to console only (dev fallback).
 *
 * Use enqueueEmail() for fire-and-forget delivery (queued via BullMQ if Redis is available).
 * Use sendEmail() directly only from workers or when synchronous confirmation is needed.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const from =
    options.from ||
    process.env.EMAIL_FROM ||
    "noreply@company.com";

  const transport = getTransporter();

  if (!transport) {
    // Dev fallback: log to console
    console.log("\n📧 [Email - not sent, SMTP not configured]");
    console.log(`  To:      ${options.to}`);
    console.log(`  From:    ${from}`);
    console.log(`  Subject: ${options.subject}`);
    console.log("─".repeat(50));
    return { success: true, simulated: true };
  }

  try {
    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Email send failed:", message);
    return { success: false, error: message };
  }
}

/**
 * Queue an email for delivery.
 * BullMQ removed — sends directly.
 */
export async function enqueueEmail(options: SendEmailOptions): Promise<void> {
  await sendEmail(options);
}

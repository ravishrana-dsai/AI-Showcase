import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (user) {
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store using VerificationToken model
    await prisma.verificationToken.deleteMany({
      where: { identifier: `reset:${user.email}` },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${user.email}`,
        token,
        expires,
      },
    });

    const appUrl = process.env.APP_URL || "http://localhost:3050";
    const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Talent Hub password",
      html: `
        <p>Hi${user.name ? ` ${user.name}` : ""},</p>
        <p>Someone requested a password reset for your Talent Hub account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p>
        <p>Or copy this URL: ${resetUrl}</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  }

  return NextResponse.json({
    success: true,
    message: "If that email exists, a reset link has been sent.",
  });
}

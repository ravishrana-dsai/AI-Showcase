import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, email, password } = body;

  if (!token || !email || !password) {
    return NextResponse.json(
      { error: "token, email, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain at least one letter and one number" },
      { status: 400 }
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: `reset:${email.toLowerCase()}`,
        token,
      },
    },
  });

  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired reset token" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash },
  });

  // Delete the used token
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: `reset:${email.toLowerCase()}`,
        token,
      },
    },
  });

  return NextResponse.json({ success: true });
}

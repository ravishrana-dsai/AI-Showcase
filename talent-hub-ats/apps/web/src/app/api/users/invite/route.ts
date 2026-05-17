import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { hash } from "bcryptjs";
import { USER_ROLES } from "@talent-hub/shared";
import crypto from "crypto";

const VALID_ROLES = Object.values(USER_ROLES);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as {
    id: string;
    role: string;
    organizationId?: string;
  };

  if (user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { email, name, role, title, password } = body;

    // Validate required fields
    if (!email || !name || !role) {
      return NextResponse.json(
        { error: "email, name, and role are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
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
    }

    // Check if user with email already exists in the org
    const existing = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), organizationId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists in your organization" },
        { status: 409 }
      );
    }

    // Use provided password or generate a random one
    const tempPassword =
      password && password.length >= 8
        ? (password as string)
        : crypto.randomBytes(16).toString("hex");
    const passwordHash = await hash(tempPassword, 12);

    const created = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
        title: title?.trim() || null,
        passwordHash,
        isActive: true,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        title: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ...created, tempPassword }, { status: 201 });
  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}

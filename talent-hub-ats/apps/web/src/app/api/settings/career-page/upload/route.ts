import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { uploadFile, getFileUrl } from "@/lib/storage";
import { randomUUID } from "crypto";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN"];
const MAX_SIZES: Record<string, number> = {
  logo: 512 * 1024,       // 512 KB
  banner: 3 * 1024 * 1024, // 3 MB
  og: 1024 * 1024,        // 1 MB
};
// SVG excluded: SVG files can contain <script> and event handlers, causing XSS when served inline.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as { organizationId?: string; role?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ALLOWED_ROLES.includes(user.role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const field = formData.get("field") as string | null; // "logo" | "banner" | "og"

    if (!file || !field) {
      return NextResponse.json({ error: "Missing file or field" }, { status: 400 });
    }
    if (!["logo", "banner", "og"].includes(field)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    const maxSize = MAX_SIZES[field];
    if (file.size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024) * 10) / 10;
      return NextResponse.json({ error: `File too large. Max ${maxMb} MB for ${field}.` }, { status: 400 });
    }

    const ext = file.type.split("/")[1].replace("svg+xml", "svg");
    const key = `career-page/${user.organizationId}/${field}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(buffer, key, file.type);
    const url = await getFileUrl(key);

    // Persist the URL to the config
    const urlField = field === "logo" ? "logoUrl" : field === "banner" ? "bannerImageUrl" : "ogImageUrl";
    const config = await prisma.careerPageConfig.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId, [urlField]: key },
      update: { [urlField]: key },
    });

    return NextResponse.json({ url, key, config });
  } catch (error) {
    console.error("Career page upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

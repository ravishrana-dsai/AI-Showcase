import { NextRequest, NextResponse } from "next/server";
import { getFileBuffer } from "@/lib/storage";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function extFromKey(key: string): string {
  const i = key.lastIndexOf(".");
  return i >= 0 ? key.slice(i + 1).toLowerCase() : "";
}

/**
 * Public, unauthenticated read for career-page branding files only (uploaded via settings).
 * Keys are stored as e.g. career-page/{orgId}/logo-....webp
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (path.some((segment) => segment === ".." || segment.includes("/"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const key = path.join("/");
  if (!key.startsWith("career-page/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await getFileBuffer(key);
    const ext = extFromKey(key);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

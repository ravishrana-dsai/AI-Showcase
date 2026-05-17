import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFileUrl, getFileBuffer } from "@/lib/storage";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
};

/**
 * GET /api/files/resumes/filename.pdf
 * Serve uploaded files (authenticated).
 * S3 mode: redirects to a presigned URL.
 * Local mode: streams the file from disk.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;

  // Security: reject any traversal attempts before passing to storage
  if (path.some((segment) => segment === ".." || segment.includes("/"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const key = path.join("/");

  try {
    if (process.env.S3_ENDPOINT) {
      // S3/MinIO mode: redirect to a presigned URL (avoids streaming through Next.js)
      const url = await getFileUrl(key);
      return NextResponse.redirect(url);
    }

    // Local mode: read and stream the file
    const fileBuffer = await getFileBuffer(key);
    const ext = key.split(".").pop()?.toLowerCase() || "";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Content-Disposition": `inline; filename="${path[path.length - 1]}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

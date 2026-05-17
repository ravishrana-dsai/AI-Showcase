import { NextRequest, NextResponse } from "next/server";
import { requireHiringPortalServerFetchBaseUrl } from "@/lib/hiring-portal";

/** Proxies applications to the hiring portal (DB + resume storage live there). */
export async function POST(req: NextRequest) {
  try {
    const target = `${requireHiringPortalServerFetchBaseUrl()}/api/public/jobs/apply`;
    const contentType = req.headers.get("content-type") || "";
    const body = await req.arrayBuffer();
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
      redirect: "manual",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    console.error("Careers apply proxy error:", e);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 502 });
  }
}

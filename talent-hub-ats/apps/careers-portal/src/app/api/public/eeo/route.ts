import { NextRequest, NextResponse } from "next/server";
import { requireHiringPortalServerFetchBaseUrl } from "@/lib/hiring-portal";

/** Proxies EEO submissions to the hiring portal. */
export async function POST(req: NextRequest) {
  try {
    const target = `${requireHiringPortalServerFetchBaseUrl()}/api/public/eeo`;
    const body = await req.text();
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    console.error("Careers EEO proxy error:", e);
    return NextResponse.json({ error: "Failed to save response" }, { status: 502 });
  }
}

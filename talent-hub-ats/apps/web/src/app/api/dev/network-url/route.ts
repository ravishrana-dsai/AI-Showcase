import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import os from "os";

/**
 * GET /api/dev/network-url
 * Returns the network URL(s) so other devices on the same network can access the app.
 * Only available in development; requires no auth so login page can show the link.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ urls: [] });
  }
  const urls: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces || {})) {
    for (const iface of ifaces![name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        urls.push(`http://${iface.address}:3050`);
      }
    }
  }
  return NextResponse.json({ urls });
}

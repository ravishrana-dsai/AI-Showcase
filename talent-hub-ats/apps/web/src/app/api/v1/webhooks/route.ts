import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { createHash, randomBytes } from "crypto";

// Private/internal IP ranges that must not be used as webhook targets (SSRF prevention)
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|30|31)\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // link-local / AWS IMDS
  /^fd[0-9a-f]{2}:/i,     // IPv6 ULA
  /\.internal$/i,
  /\.local$/i,
  /\.localhost$/i,
];

function validateWebhookUrl(raw: string): { valid: true } | { valid: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  if (url.protocol !== "https:") {
    return { valid: false, reason: "Webhook URL must use HTTPS" };
  }

  const hostname = url.hostname.toLowerCase();
  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: "Webhook URL cannot target internal or private addresses" };
    }
  }

  return { valid: true };
}

async function authenticateApiKey(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7);
  const hashedKey = createHash("sha256").update(key).digest("hex");
  const apiKey = await prisma.apiKey.findFirst({
    where: { hashedKey, isActive: true },
  });
  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  return apiKey;
}

export async function GET(req: NextRequest) {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const webhooks = await prisma.webhook.findMany({
    where: { organizationId: apiKey.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      lastTriggeredAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: webhooks });
}

export async function POST(req: NextRequest) {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  try {
    const { url, events } = await req.json();
    if (!url || !events) {
      return NextResponse.json(
        { error: "url and events are required" },
        { status: 400 }
      );
    }

    const urlCheck = validateWebhookUrl(url);
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
    }

    const secret = randomBytes(32).toString("hex");
    const webhook = await prisma.webhook.create({
      data: {
        url,
        events: JSON.stringify(events),
        secret,
        organizationId: apiKey.organizationId,
      },
    });

    return NextResponse.json(
      { data: { ...webhook, secret } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

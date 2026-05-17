import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";

// CSV/JSON bulk import for courts and requests from Google Sheets exports

const courtImportSchema = z.object({
  name: z.string(),
  city: z.string(),
  state: z.string().optional(),
  partnerName: z.string().optional(),
  partnerContact: z.string().optional(),
  partnerEmail: z.string().optional(),
  surfaceType: z.string().optional(),
  totalCourts: z.coerce.number().int().min(1).optional(),
  externalId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ONBOARDING", "SUSPENDED"]).optional(),
});

const requestImportSchema = z.object({
  externalId: z.string().optional(),
  courtExternalId: z.string().optional(),
  courtName: z.string().optional(),
  playerId: z.string().optional(),
  playerName: z.string().optional(),
  matchDate: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  videoUrl: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
});

const importPayloadSchema = z.object({
  type: z.enum(["courts", "requests"]),
  rows: z.array(z.record(z.unknown())),
  dryRun: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["ADMIN", "OPS"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { type, rows, dryRun } = parsed.data;
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  if (type === "courts") {
    for (const row of rows) {
      const validated = courtImportSchema.safeParse(row);
      if (!validated.success) {
        results.errors.push(`Row error: ${JSON.stringify(validated.error.issues[0])}`);
        results.skipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.court.upsert({
          where: { externalId: validated.data.externalId ?? `import-${Date.now()}-${Math.random()}` },
          create: validated.data,
          update: validated.data,
        });
      }
      results.imported++;
    }
  } else if (type === "requests") {
    for (const row of rows) {
      const validated = requestImportSchema.safeParse(row);
      if (!validated.success) {
        results.errors.push(`Row error: ${JSON.stringify(validated.error.issues[0])}`);
        results.skipped++;
        continue;
      }

      // Resolve court
      let court = validated.data.courtExternalId
        ? await prisma.court.findUnique({ where: { externalId: validated.data.courtExternalId } })
        : validated.data.courtName
        ? await prisma.court.findFirst({ where: { name: { contains: validated.data.courtName, mode: "insensitive" } } })
        : null;

      if (!court) {
        results.errors.push(`Court not found for row: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }

      if (!dryRun) {
        const key = validated.data.externalId ?? `import-${Date.now()}-${Math.random()}`;
        await prisma.request.upsert({
          where: { externalId: key },
          create: {
            externalId: key,
            courtId: court.id,
            playerId: validated.data.playerId,
            playerName: validated.data.playerName,
            matchDate: validated.data.matchDate ? new Date(validated.data.matchDate) : undefined,
            videoUrl: validated.data.videoUrl,
            status: validated.data.status ?? "PENDING",
            notes: validated.data.notes,
            assignedTo: validated.data.assignedTo,
          },
          update: {},
        });
      }
      results.imported++;
    }
  }

  if (!dryRun) {
    await invalidateCache(CACHE_KEYS.dashboardStats, CACHE_KEYS.courtList);
  }

  return NextResponse.json({ data: results, dryRun });
}

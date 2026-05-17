import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";
import { z } from "zod";
import crypto from "crypto";

// ─── Payload Schemas ──────────────────────────────────────────────────────────

const stageEventSchema = z.object({
  event: z.literal("stage_update"),
  externalRequestId: z.string(),
  externalCourtId: z.string(),
  stageName: z.string(),
  stageStatus: z.enum(["started", "completed", "failed"]),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
});

const newRequestSchema = z.object({
  event: z.literal("request_created"),
  externalRequestId: z.string(),
  externalCourtId: z.string(),
  playerId: z.string().optional(),
  playerName: z.string().optional(),
  matchDate: z.string().optional(),
  videoUrl: z.string().optional(),
  videoDuration: z.number().optional(),
  videoSizeBytes: z.number().optional(),
  videoMetadata: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

const webhookSchema = z.discriminatedUnion("event", [stageEventSchema, newRequestSchema]);

// ─── Signature Verification ───────────────────────────────────────────────────

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`sha256=${expected}`));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-company-signature") ?? "";

  if (process.env.NODE_ENV === "production" && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.event === "request_created") {
    await handleNewRequest(parsed.data);
  } else if (parsed.data.event === "stage_update") {
    await handleStageUpdate(parsed.data);
  }

  return NextResponse.json({ ok: true });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleNewRequest(data: z.infer<typeof newRequestSchema>) {
  // Find or create court by externalId
  const court = await prisma.court.findUnique({
    where: { externalId: data.externalCourtId },
  });
  if (!court) {
    console.warn(`[webhook] Court not found for externalId: ${data.externalCourtId}`);
    return;
  }

  // Create request (upsert to handle duplicate webhooks)
  await prisma.request.upsert({
    where: { externalId: data.externalRequestId },
    create: {
      externalId: data.externalRequestId,
      courtId: court.id,
      playerId: data.playerId,
      playerName: data.playerName,
      matchDate: data.matchDate ? new Date(data.matchDate) : undefined,
      videoUrl: data.videoUrl,
      videoDuration: data.videoDuration,
      videoSizeBytes: data.videoSizeBytes ? BigInt(data.videoSizeBytes) : undefined,
      videoMetadata: data.videoMetadata ?? undefined,
      status: "PENDING",
    },
    update: {}, // Don't overwrite if already exists
  });

  await invalidateCache(CACHE_KEYS.dashboardStats, CACHE_KEYS.courtStats(court.id));
}

async function handleStageUpdate(data: z.infer<typeof stageEventSchema>) {
  const request = await prisma.request.findUnique({
    where: { externalId: data.externalRequestId },
    select: { id: true, courtId: true },
  });
  if (!request) {
    console.warn(`[webhook] Request not found for externalId: ${data.externalRequestId}`);
    return;
  }

  const stage = await prisma.pipelineStage.findUnique({
    where: { name: data.stageName },
  });
  if (!stage) {
    console.warn(`[webhook] Stage not found: ${data.stageName}`);
    return;
  }

  const timestamp = new Date(data.timestamp);

  if (data.stageStatus === "started") {
    // Upsert stage log as IN_PROGRESS
    await prisma.requestStageLog.upsert({
      where: {
        // Composite unique would be better; using findFirst pattern
        id: (
          await prisma.requestStageLog.findFirst({
            where: { requestId: request.id, stageId: stage.id },
            select: { id: true },
          })
        )?.id ?? "new",
      },
      create: {
        requestId: request.id,
        stageId: stage.id,
        status: "IN_PROGRESS",
        startedAt: timestamp,
        updatedBy: "system",
        metadata: data.metadata ?? undefined,
      },
      update: {
        status: "IN_PROGRESS",
        startedAt: timestamp,
        updatedBy: "system",
      },
    });

    // Update request current stage
    await prisma.request.update({
      where: { id: request.id },
      data: { currentStageId: stage.id, status: "IN_PROGRESS" },
    });
  } else if (data.stageStatus === "completed" || data.stageStatus === "failed") {
    const existing = await prisma.requestStageLog.findFirst({
      where: { requestId: request.id, stageId: stage.id },
    });

    const durationMin = existing?.startedAt
      ? (timestamp.getTime() - existing.startedAt.getTime()) / 60000
      : null;

    if (existing) {
      await prisma.requestStageLog.update({
        where: { id: existing.id },
        data: {
          status: data.stageStatus === "completed" ? "COMPLETED" : "FAILED",
          completedAt: timestamp,
          durationMin: durationMin ?? undefined,
          errorMessage: data.errorMessage,
          updatedBy: "system",
        },
      });
    }

    // Check SLA breach
    if (existing?.startedAt && durationMin) {
      const slaMinutes = Number(stage.slaHours) * 60;
      if (durationMin > slaMinutes) {
        await Promise.all([
          prisma.slaAlert.create({
            data: {
              requestId: request.id,
              stageId: stage.id,
              alertType: "SLA_BREACH",
              message: `Stage "${stage.displayName}" took ${Math.round(durationMin)}min (SLA: ${slaMinutes}min)`,
            },
          }),
          prisma.request.update({
            where: { id: request.id },
            data: { slaBreached: true },
          }),
        ]);
      }
    }

    // If all stages complete → mark request completed
    if (data.stageStatus === "completed") {
      const allStages = await prisma.pipelineStage.findMany({ where: { isActive: true } });
      const completedLogs = await prisma.requestStageLog.findMany({
        where: { requestId: request.id, status: "COMPLETED" },
      });
      if (completedLogs.length >= allStages.length) {
        await prisma.request.update({
          where: { id: request.id },
          data: { status: "COMPLETED", completedAt: timestamp },
        });
      }
    }

    if (data.stageStatus === "failed") {
      await prisma.request.update({
        where: { id: request.id },
        data: {
          status: "FAILED",
          lastError: data.errorMessage,
          errorLogs: { stage: data.stageName, error: data.errorMessage, at: data.timestamp },
        },
      });

      await prisma.slaAlert.create({
        data: {
          requestId: request.id,
          stageId: stage.id,
          alertType: "ERROR",
          message: `Stage "${stage.displayName}" failed: ${data.errorMessage ?? "Unknown error"}`,
        },
      });
    }
  }

  await invalidateCache(
    CACHE_KEYS.dashboardStats,
    CACHE_KEYS.courtStats(request.courtId),
    CACHE_KEYS.requestsByStage,
    CACHE_KEYS.slaBreaches
  );
}

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { prisma } from "@talent-hub/db";
import { parseResume } from "@/lib/resume-parser";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

const UPLOAD_DIR = join(process.cwd(), "../../uploads/resumes");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

/**
 * Validate file content via magic bytes rather than trusting the client-supplied MIME type.
 * Returns the canonical MIME type when valid, null when the content does not match any allowed format.
 */
function detectFileMimeType(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf";
  }

  // DOCX (ZIP container): PK\x03\x04
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // DOC (OLE2 compound): D0 CF 11 E0
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
    return "application/msword";
  }

  // Plain text: no null bytes in first 512 bytes (heuristic)
  const sample = buf.slice(0, Math.min(512, buf.length));
  if (!sample.includes(0x00)) {
    return "text/plain";
  }

  return null;
}

function getString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Public apply to a job (no auth). Accepts JSON or FormData (with optional CV file). */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let jobId: string;
    let firstName: string;
    let lastName: string;
    let email: string;
    let phone: string;
    let summary: string;
    let linkedinUrl: string;
    let portfolioUrl: string;
    let screeningAnswers: string = "[]";
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      jobId = getString(form, "jobId");
      firstName = getString(form, "firstName");
      lastName = getString(form, "lastName");
      email = getString(form, "email");
      phone = getString(form, "phone");
      summary = getString(form, "summary");
      linkedinUrl = getString(form, "linkedinUrl");
      portfolioUrl = getString(form, "portfolioUrl");
      screeningAnswers = getString(form, "screeningAnswers") || "[]";
      const f = form.get("cv") as File | null;
      if (f && f.size > 0) {
        if (f.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "CV must be under 10MB" },
            { status: 400 }
          );
        }
        // Validate by magic bytes, not client-supplied Content-Type
        const previewBytes = Buffer.from(await f.slice(0, 512).arrayBuffer());
        const detectedType = detectFileMimeType(previewBytes);
        if (!detectedType || !ALLOWED_TYPES.includes(detectedType)) {
          return NextResponse.json(
            { error: "CV must be PDF, DOCX, DOC, or TXT" },
            { status: 400 }
          );
        }
        file = f;
      }
    } else {
      const body = await req.json();
      jobId = body.jobId?.trim() ?? "";
      firstName = body.firstName?.trim() ?? "";
      lastName = body.lastName?.trim() ?? "";
      email = body.email?.trim() ?? "";
      phone = body.phone?.trim() ?? "";
      summary = body.summary?.trim() ?? "";
      linkedinUrl = body.linkedinUrl?.trim() ?? "";
      portfolioUrl = body.portfolioUrl?.trim() ?? "";
      screeningAnswers = body.screeningAnswers ?? "[]";
    }

    if (!jobId || !firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "jobId, firstName, lastName, and email are required" },
        { status: 400 }
      );
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...publicCareersJobWhere },
      include: {
        pipelineStages: { orderBy: { order: "asc" }, take: 1 },
      },
    });

    if (!job || job.pipelineStages.length === 0) {
      return NextResponse.json({ error: "Job not found or not accepting applications" }, { status: 404 });
    }

    const firstStageId = job.pipelineStages[0].id;
    const orgId = job.organizationId;
    const normalizedEmail = email.toLowerCase();

    let candidate = await prisma.candidate.findFirst({
      where: { email: normalizedEmail, organizationId: orgId },
    });

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          phone: phone || null,
          summary: summary || null,
          linkedinUrl: linkedinUrl || null,
          portfolioUrl: portfolioUrl || null,
          source: "Career Site",
          organizationId: orgId,
        },
      });
    }

    const existingApp = await prisma.application.findFirst({
      where: { jobId, candidateId: candidate.id, status: "ACTIVE" },
    });
    if (existingApp) {
      return NextResponse.json(
        { error: "You have already applied to this job", applicationId: existingApp.id },
        { status: 409 }
      );
    }

    const application = await prisma.application.create({
      data: {
        jobId,
        candidateId: candidate.id,
        currentStageId: firstStageId,
        status: "ACTIVE",
        source: "Career Site",
        screeningAnswers,
      },
    });

    if (file) {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const fileId = randomUUID();
      // Derive extension from content, not the user-supplied filename
      const fileBytes = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectFileMimeType(fileBytes);
      const EXT_MAP: Record<string, string> = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/msword": "doc",
        "text/plain": "txt",
      };
      const ext = detectedMime ? (EXT_MAP[detectedMime] ?? "bin") : "bin";
      const fileName = `${fileId}.${ext}`;
      const filePath = join(UPLOAD_DIR, fileName);
      await writeFile(filePath, fileBytes);
      let resumeParsedText: string | null = null;
      try {
        const parsedResume = await parseResume(fileBytes, detectedMime ?? file.type);
        resumeParsedText = parsedResume.rawText ?? null;
      } catch {
        // Non-fatal: file stored, text extraction failed
      }
      await prisma.document.create({
        data: {
          name: file.name,
          type: "RESUME",
          url: `/uploads/resumes/${fileName}`,
          size: file.size,
          mimeType: detectedMime ?? file.type,
          parsedText: resumeParsedText,
          candidateId: candidate.id,
        },
      });
    }

    return NextResponse.json({ success: true, applicationId: application.id }, { status: 201 });
  } catch (e) {
    console.error("Public apply error:", e);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}

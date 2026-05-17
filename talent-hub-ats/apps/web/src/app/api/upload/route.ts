import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@talent-hub/db";
import { parseResume, scoreResumeAgainstJob } from "@/lib/resume-parser";
import { randomUUID } from "crypto";
import { uploadFile } from "@/lib/storage";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

/**
 * POST /api/upload
 * Upload a resume file, parse it, and optionally create/update a candidate
 *
 * Form data:
 * - file: The resume file (required)
 * - candidateId: Existing candidate to attach to (optional)
 * - jobId: Job to score against (optional)
 * - mode: "parse_only" | "create_candidate" | "attach" (default: "attach")
 *   create_candidate: if no email is extracted, stores resume-{id}@pending.noreply (emailPending in customFields).
 * - pdfOcr: optional "skip" to disable **optional** OCR (when text is long but low-quality).
 *   Short / failed extraction still runs OCR by default unless RESUME_PDF_OCR is off.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const candidateId = formData.get("candidateId") as string | null;
    const jobId = formData.get("jobId") as string | null;
    const mode = (formData.get("mode") as string) || "attach";
    const skipPdfOcr = formData.get("pdfOcr") === "skip";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, DOC, TXT`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store file (local disk in dev, S3/MinIO in production)
    const fileId = randomUUID();
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `${fileId}.${ext}`;
    const storageKey = `resumes/${fileName}`;
    await uploadFile(buffer, storageKey, file.type);

    // Parse resume
    let parsed: Awaited<ReturnType<typeof parseResume>> | null = null;
    let parseErrorMessage: string | null = null;
    try {
      parsed = await parseResume(buffer, file.type, { skipPdfOcr });
    } catch (parseError) {
      console.error("Resume parse error:", parseError);
      const msg = parseError instanceof Error ? parseError.message : "Unknown error";
      // Friendly hint for common PDF issues (scanned/image-based, etc.)
      parseErrorMessage =
        msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("could not")
          ? "This file could not be read. It may be a scanned or image-based PDF with no selectable text. You can still fill in the details manually."
          : msg;
    }

    // Score against job if provided
    let matchScore: number | null = null;
    if (parsed && jobId) {
      const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: user.organizationId },
      });
      if (job) {
        matchScore = scoreResumeAgainstJob(
          parsed.skills,
          parsed.rawText,
          job.description,
          job.requirements || ""
        );
      }
    }

    // Mode: parse_only - just return parsed data
    if (mode === "parse_only") {
      return NextResponse.json({
        success: !!parsed,
        parsed,
        error: parseErrorMessage ?? undefined,
        matchScore,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          storedAs: storageKey,
        },
      });
    }

    // Mode: create_candidate - create a new candidate from parsed data
    if (mode === "create_candidate") {
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              parseErrorMessage ??
              "Could not read this resume. Try another format or add the candidate manually.",
            parsed: null,
            file: { name: file.name, size: file.size, storedAs: storageKey },
          },
          { status: 422 }
        );
      }

      const emailPending = !parsed.email;
      const effectiveEmail =
        parsed.email?.toLowerCase().trim() ||
        `resume-${randomUUID().replace(/-/g, "").slice(0, 24)}@pending.noreply`;

      // Duplicate check only when we have a real extracted email
      const existing = emailPending
        ? null
        : await prisma.candidate.findFirst({
            where: {
              email: effectiveEmail,
              organizationId: user.organizationId,
            },
          });

      if (existing) {
        // Attach document to existing candidate instead
        const doc = await prisma.document.create({
          data: {
            name: file.name,
            type: "RESUME",
            url: storageKey,
            size: file.size,
            mimeType: file.type,
            parsedText: parsed?.rawText ?? null,
            candidateId: existing.id,
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            type: "resume_uploaded",
            description: `Resume "${file.name}" uploaded (candidate already exists)`,
            candidateId: existing.id,
            actorId: user.id,
            organizationId: user.organizationId,
          },
        });

        // If a jobId was provided, still try to add them to the pipeline
        let existingApp = null;
        if (jobId) {
          const job = await prisma.job.findFirst({
            where: { id: jobId, organizationId: user.organizationId, status: "OPEN" },
            include: {
              pipelineStages: { orderBy: { order: "asc" }, take: 1 },
            },
          });
          if (job?.pipelineStages?.[0]) {
            const firstStage = job.pipelineStages[0];
            const alreadyApplied = await prisma.application.findFirst({
              where: { candidateId: existing.id, jobId: job.id },
            });
            if (!alreadyApplied) {
              existingApp = await prisma.application.create({
                data: {
                  candidateId: existing.id,
                  jobId: job.id,
                  currentStageId: firstStage.id,
                  status: "ACTIVE",
                  source: "Resume Upload",
                  recruiterId: user.id,
                  stageHistory: { create: { stageId: firstStage.id, enteredAt: new Date() } },
                },
                include: { currentStage: true },
              });
            }
          }
        }

        return NextResponse.json({
          success: true,
          candidate: existing,
          document: doc,
          application: existingApp,
          parsed,
          matchScore,
          isDuplicate: true,
          message: `Candidate already exists. Resume attached to ${existing.firstName} ${existing.lastName}.`,
        });
      }

      // If the parser couldn't find a name, try to extract it from the filename.
      // e.g. "NEHASINGH[11y_0m].pdf" → "Neha Singh"
      if (!parsed.firstName) {
        const baseName = file.name
          .replace(/\.[^.]+$/, "")          // remove extension
          .replace(/\[.*?\]/g, "")          // remove [11y_0m] style brackets
          .replace(/[_\-]/g, " ")           // underscores/dashes → spaces
          .trim();
        // Split AllCaps run "NEHASINGH" → ["NEHA", "SINGH"] by detecting word boundaries
        // where a lowercase letter is followed by uppercase, or all-caps consecutive runs are split
        // by inserting a space before each run of capitals that follows non-whitespace.
        const spaced = baseName
          .replace(/([a-z])([A-Z])/g, "$1 $2")   // camelCase
          .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"); // "NEHASingh" → "NEHA Singh"
        const parts = spaced.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          // Title-case each part
          const titled = parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase());
          parsed.firstName = titled[0];
          parsed.lastName = titled.slice(1).join(" ");
        } else if (parts.length === 1 && parts[0].length >= 3) {
          // Single token — use as first name only
          const p = parts[0];
          parsed.firstName = p[0].toUpperCase() + p.slice(1).toLowerCase();
          parsed.lastName = null;
        }
      }

      // Create new candidate
      const candidate = await prisma.candidate.create({
        data: {
          firstName: parsed.firstName || "Unknown",
          lastName: parsed.lastName || "Candidate",
          email: effectiveEmail,
          phone: parsed.phone || undefined,
          linkedinUrl: parsed.linkedinUrl || undefined,
          portfolioUrl: parsed.portfolioUrl || undefined,
          summary: parsed.summary || undefined,
          source: "Resume Upload",
          sourceDetail: `Parsed from ${file.name}`,
          customFields: JSON.stringify({
            skills: parsed.skills,
            experience: parsed.experience,
            education: parsed.education,
            matchScore,
            emailPending,
          }),
          organizationId: user.organizationId,
          documents: {
            create: {
              name: file.name,
              type: "RESUME",
              url: storageKey,
              size: file.size,
              mimeType: file.type,
              parsedText: parsed?.rawText ?? null,
            },
          },
        },
        include: { documents: true },
      });

      // If a jobId was provided, add the candidate to that job's pipeline
      let application = null;
      if (jobId) {
        const job = await prisma.job.findFirst({
          where: { id: jobId, organizationId: user.organizationId, status: "OPEN" },
          include: {
            pipelineStages: { orderBy: { order: "asc" }, take: 1 },
          },
        });

        if (job?.pipelineStages?.[0]) {
          const firstStage = job.pipelineStages[0];

          // Check if an application already exists for this candidate+job
          const existingApp = await prisma.application.findFirst({
            where: { candidateId: candidate.id, jobId: job.id },
          });

          if (!existingApp) {
            application = await prisma.application.create({
              data: {
                candidateId: candidate.id,
                jobId: job.id,
                currentStageId: firstStage.id,
                status: "ACTIVE",
                source: "Resume Upload",
                recruiterId: user.id,
                stageHistory: {
                  create: {
                    stageId: firstStage.id,
                    enteredAt: new Date(),
                  },
                },
              },
              include: { currentStage: true },
            });

            await prisma.activityLog.create({
              data: {
                type: "application_created",
                description: `Added to pipeline for "${job.title}" via resume upload`,
                candidateId: candidate.id,
                actorId: user.id,
                organizationId: user.organizationId,
              },
            });
          }
        }
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          type: "candidate_created",
          description: `Candidate created from resume upload: ${candidate.firstName} ${candidate.lastName}`,
          candidateId: candidate.id,
          actorId: user.id,
          organizationId: user.organizationId,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "candidate.create",
          entityType: "candidate",
          entityId: candidate.id,
          actorId: user.id,
          actorEmail: user.email,
          metadata: JSON.stringify({
            source: "resume_upload",
            fileName: file.name,
            parsedSkills: parsed.skills,
            jobId: jobId ?? null,
          }),
          organizationId: user.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        candidate,
        application,
        parsed,
        matchScore,
        isDuplicate: false,
        emailPending,
      });
    }

    // Mode: attach - attach resume to existing candidate
    if (mode === "attach" && candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: { id: candidateId, organizationId: user.organizationId },
      });

      if (!candidate) {
        return NextResponse.json(
          { error: "Candidate not found" },
          { status: 404 }
        );
      }

      const doc = await prisma.document.create({
        data: {
          name: file.name,
          type: "RESUME",
          url: storageKey,
          size: file.size,
          mimeType: file.type,
          parsedText: parsed?.rawText ?? null,
          candidateId: candidate.id,
        },
      });

      // Update candidate with parsed data if fields are empty
      if (parsed) {
        const updates: Record<string, any> = {};
        if (!candidate.phone && parsed.phone) updates.phone = parsed.phone;
        if (!candidate.linkedinUrl && parsed.linkedinUrl)
          updates.linkedinUrl = parsed.linkedinUrl;
        if (!candidate.summary && parsed.summary)
          updates.summary = parsed.summary;

        if (Object.keys(updates).length > 0) {
          await prisma.candidate.update({
            where: { id: candidate.id },
            data: updates,
          });
        }
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          type: "resume_uploaded",
          description: `Resume "${file.name}" uploaded`,
          candidateId: candidate.id,
          actorId: user.id,
          organizationId: user.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        document: doc,
        parsed,
        matchScore,
      });
    }

    return NextResponse.json(
      { error: "Invalid mode or missing candidateId for attach mode" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

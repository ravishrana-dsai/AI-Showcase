import { prisma } from "@talent-hub/db";

/**
 * Merge a duplicate candidate into a primary candidate.
 *
 * All child records (applications, notes, documents, tags, activities, EEO)
 * are reparented from duplicate to primary. Fields from primary take precedence;
 * blanks in primary are filled from duplicate. The duplicate is deleted.
 */
export async function mergeCandidates(
  primaryId: string,
  duplicateId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const [primary, duplicate] = await Promise.all([
    prisma.candidate.findFirst({
      where: { id: primaryId, organizationId },
      include: { applications: { select: { jobId: true, id: true, currentStageId: true } } },
    }),
    prisma.candidate.findFirst({
      where: { id: duplicateId, organizationId },
      include: { applications: { select: { jobId: true, id: true, currentStageId: true } } },
    }),
  ]);

  if (!primary || !duplicate) {
    throw new Error("One or both candidates not found");
  }

  if (primary.id === duplicate.id) {
    throw new Error("Cannot merge a candidate with itself");
  }

  await prisma.$transaction(async (tx) => {
    // Determine which of duplicate's applications can be reparented
    // (skip those where primary already has an application for the same job)
    const primaryJobIds = new Set(primary.applications.map((a) => a.jobId));

    for (const dupApp of duplicate.applications) {
      if (primaryJobIds.has(dupApp.jobId)) {
        // Both candidates have an application for the same job — delete the duplicate's application
        await tx.application.delete({ where: { id: dupApp.id } });
      } else {
        // Reparent the application to the primary candidate
        await tx.application.update({
          where: { id: dupApp.id },
          data: { candidateId: primaryId },
        });
      }
    }

    // Reparent notes
    await tx.note.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    });

    // Reparent documents
    await tx.document.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    });

    // Reparent activity logs
    await tx.activityLog.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    });

    // Reparent tags (skip duplicates — CandidateTag has composite PK)
    const [primaryTags, duplicateTags] = await Promise.all([
      tx.candidateTag.findMany({ where: { candidateId: primaryId }, select: { tagId: true } }),
      tx.candidateTag.findMany({ where: { candidateId: duplicateId }, select: { tagId: true } }),
    ]);
    const primaryTagIds = new Set(primaryTags.map((t) => t.tagId));

    for (const dupTag of duplicateTags) {
      if (!primaryTagIds.has(dupTag.tagId)) {
        await tx.candidateTag.create({
          data: { candidateId: primaryId, tagId: dupTag.tagId },
        });
      }
    }
    await tx.candidateTag.deleteMany({ where: { candidateId: duplicateId } });

    // Merge blank fields from duplicate into primary
    const mergedFields: Record<string, unknown> = {};
    const fillableFields = [
      "phone", "linkedinUrl", "portfolioUrl", "currentCompany",
      "currentTitle", "location", "summary", "source", "sourceDetail",
      "expectedCtc", "noticePeriod",
    ] as const;

    for (const field of fillableFields) {
      if (!primary[field] && duplicate[field]) {
        mergedFields[field] = duplicate[field];
      }
    }

    if (Object.keys(mergedFields).length > 0) {
      await tx.candidate.update({ where: { id: primaryId }, data: mergedFields });
    }

    // Delete duplicate's EEO response if primary already has one; otherwise reparent
    const primaryEeo = await tx.eeoResponse.findUnique({ where: { candidateId: primaryId } });
    if (!primaryEeo) {
      await tx.eeoResponse.updateMany({
        where: { candidateId: duplicateId },
        data: { candidateId: primaryId },
      });
    } else {
      await tx.eeoResponse.deleteMany({ where: { candidateId: duplicateId } });
    }

    // Delete the duplicate candidate
    await tx.candidate.delete({ where: { id: duplicateId } });

    // Audit log
    await tx.auditLog.create({
      data: {
        action: "candidate.merged",
        entityType: "Candidate",
        entityId: primaryId,
        actorId,
        metadata: JSON.stringify({ mergedFrom: duplicateId }),
        organizationId,
      },
    });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@talent-hub/db";
import { deleteFile } from "@/lib/storage";

/**
 * DELETE /api/candidates/:id/delete
 * GPlayer Rating-compliant candidate data deletion
 * Permanently removes all candidate data and creates an audit log entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;

  // Only admins can delete candidate data
  if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Find the candidate
    const candidate = await prisma.candidate.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        applications: true,
        documents: true,
        notes: true,
        eeoResponse: true,
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // Store info for audit log before deletion
    const candidateInfo = {
      name: `${candidate.firstName} ${candidate.lastName}`,
      email: candidate.email,
      applicationCount: candidate.applications.length,
      documentCount: candidate.documents.length,
    };

    // Delete all related data (cascading deletes handle most of this)
    // The Prisma schema has onDelete: Cascade for most relations

    // Delete S3/MinIO files before DB deletion (must happen first since cascade removes DB records)
    for (const doc of candidate.documents) {
      if (doc.url) {
        // url may be a storage key or full URL — extract the key
        const key = doc.url.startsWith("/api/files/")
          ? doc.url.replace("/api/files/", "")
          : doc.url;
        await deleteFile(key);
      }
    }

    // Delete the candidate (cascades to applications, documents, notes, tags, activities, eeo)
    await prisma.candidate.delete({
      where: { id },
    });

    // Create audit log entry for the deletion
    await prisma.auditLog.create({
      data: {
        action: "candidate.gdpr_delete",
        entityType: "candidate",
        entityId: id,
        actorId: user.id,
        actorEmail: user.email,
        metadata: JSON.stringify({
          deletedCandidate: candidateInfo,
          gdprDeletion: true,
          reason: "GPlayer Rating data deletion request",
          timestamp: new Date().toISOString(),
        }),
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `All data for ${candidateInfo.name} (${candidateInfo.email}) has been permanently deleted.`,
      deleted: candidateInfo,
    });
  } catch (error) {
    console.error("GPlayer Rating deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete candidate data" },
      { status: 500 }
    );
  }
}

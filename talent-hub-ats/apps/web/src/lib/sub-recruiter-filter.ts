import { prisma } from "@talent-hub/db";

type SessionUser = { id: string; role: string; organizationId: string };

const SCOPED_ROLES = ["SUB_RECRUITER", "HIRING_MANAGER"];

export async function getAssignedJobIds(userId: string): Promise<string[]> {
  const assignments = await prisma.userJobAssignment.findMany({
    where: { userId },
    select: { jobId: true },
  });
  return assignments.map((a) => a.jobId);
}

/** Get job IDs the hiring manager owns */
async function getHiringManagerJobIds(
  userId: string,
  organizationId: string
): Promise<string[]> {
  const jobs = await prisma.job.findMany({
    where: { hiringManagerId: userId, organizationId },
    select: { id: true },
  });
  return jobs.map((j) => j.id);
}

/** Get visible job IDs for scoped roles */
async function getVisibleJobIds(user: SessionUser): Promise<string[]> {
  if (user.role === "SUB_RECRUITER") {
    return getAssignedJobIds(user.id);
  }
  if (user.role === "HIRING_MANAGER") {
    return getHiringManagerJobIds(user.id, user.organizationId);
  }
  return [];
}

// For jobs page: scoped roles see only their jobs
export async function jobWhereForUser(
  user: SessionUser,
  baseWhere: Record<string, unknown>
) {
  if (!SCOPED_ROLES.includes(user.role)) return baseWhere;

  if (user.role === "HIRING_MANAGER") {
    return {
      ...baseWhere,
      hiringManagerId: user.id,
    };
  }

  // SUB_RECRUITER: assigned jobs + jobs they created
  const assignedJobIds = await getAssignedJobIds(user.id);
  return {
    ...baseWhere,
    OR: [{ id: { in: assignedJobIds } }, { createdById: user.id }],
  };
}

// For candidates: scoped roles see only candidates in their jobs
export async function candidateWhereForUser(
  user: SessionUser,
  baseWhere: Record<string, unknown>
) {
  if (!SCOPED_ROLES.includes(user.role)) return baseWhere;

  const jobIds = await getVisibleJobIds(user);

  if (user.role === "HIRING_MANAGER") {
    return {
      ...baseWhere,
      applications: { some: { job: { id: { in: jobIds } } } },
    };
  }

  // SUB_RECRUITER
  return {
    ...baseWhere,
    OR: [
      { applications: { some: { job: { id: { in: jobIds } } } } },
      { applications: { some: { recruiterId: user.id } } },
      { createdById: user.id },
    ],
  };
}

// For applications: scoped roles see only applications for their jobs
export async function applicationWhereForUser(
  user: SessionUser,
  baseWhere: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  if (!SCOPED_ROLES.includes(user.role)) return baseWhere;
  const jobIds = await getVisibleJobIds(user);

  if (user.role === "HIRING_MANAGER") {
    return {
      ...baseWhere,
      job: { id: { in: jobIds } },
    };
  }

  // SUB_RECRUITER
  return {
    ...baseWhere,
    job: { OR: [{ id: { in: jobIds } }, { createdById: user.id }] },
  };
}

// For offers/interviews: filter by visible jobs
export async function applicationJobFilterForUser(user: SessionUser) {
  if (!SCOPED_ROLES.includes(user.role)) return {};
  const jobIds = await getVisibleJobIds(user);
  return { application: { job: { id: { in: jobIds } } } };
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { InterviewRoom } from "./InterviewRoom";

interface PageProps {
  params: { token: string };
}

export default async function InterviewPage({ params }: PageProps) {
  const interview = await prisma.interview.findUnique({
    where: { token: params.token },
    include: { candidate: true, role: true },
  });

  if (!interview) notFound();

  return (
    <InterviewRoom
      interviewId={interview.id}
      candidateName={interview.candidate.name}
      roleTitle={interview.role.name}
      initialStatus={interview.status}
    />
  );
}

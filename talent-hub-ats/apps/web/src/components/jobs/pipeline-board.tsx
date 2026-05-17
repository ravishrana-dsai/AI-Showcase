"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

type Stage = {
  id: string;
  name: string;
  type: string;
  order: number;
};

type Application = {
  id: string;
  currentStageId: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    currentTitle: string | null;
    currentCompany: string | null;
  };
  recruiter?: { id: string; name: string | null; email: string } | null;
  appliedAt: string;
};

type UserOption = { id: string; name: string | null; email: string };

interface PipelineBoardProps {
  jobId: string;
  stages: Stage[];
  applications: Application[];
  users?: UserOption[];
  onMoveSuccess?: () => void;
}

function ApplicationCard({
  application,
  users,
  onRecruiterChange,
}: {
  application: Application;
  users: UserOption[];
  onRecruiterChange: (applicationId: string, recruiterId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: application.id,
    data: { application },
  });

  const fullName = `${application.candidate.firstName} ${application.candidate.lastName}`.trim() || "Unknown";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: "none" }}
      className={cn(
        "rounded-lg border bg-card p-2 transition-shadow",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-50 shadow-lg scale-95 ring-2 ring-primary/20"
      )}
    >
      <Link
        href={`/dashboard/candidates/${application.candidate.id}`}
        className="font-medium text-sm hover:underline block truncate"
        onClick={(e) => isDragging && e.preventDefault()}
      >
        {fullName}
      </Link>
      {application.candidate.currentCompany && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {application.candidate.currentCompany}
        </p>
      )}
    </div>
  );
}

function LoadingCard({ application }: { application: Application }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/80 p-3">
      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Moving...</span>
      </div>
    </div>
  );
}

function DroppableColumn({
  stage,
  applications,
  movingApplication,
  movingTargetStageId,
  users,
  onRecruiterChange,
}: {
  stage: Stage;
  applications: Application[];
  movingApplication: Application | null;
  movingTargetStageId: string | null;
  users: UserOption[];
  onRecruiterChange: (applicationId: string, recruiterId: string | null) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  const isTargetColumn = movingTargetStageId === stage.id;
  const visibleApplications = applications.filter(
    (a) => a.id !== movingApplication?.id
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-56 rounded-xl border bg-card/50 transition-colors",
        isOver && "ring-2 ring-primary/30 bg-card"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">{stage.name}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {applications.length + (isTargetColumn && movingApplication ? 1 : 0)}
        </span>
      </div>
      <div className="p-3 space-y-2 min-h-[120px]">
        {visibleApplications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            users={users}
            onRecruiterChange={onRecruiterChange}
          />
        ))}
        {isTargetColumn && movingApplication && (
          <LoadingCard application={movingApplication} />
        )}
      </div>
    </div>
  );
}

function OverlayCard({ application }: { application: Application }) {
  const fullName = `${application.candidate.firstName} ${application.candidate.lastName}`.trim() || "Unknown";

  return (
    <div className="rounded-lg border bg-card p-3 shadow-xl scale-105 rotate-1 cursor-grabbing w-64">
      <p className="font-medium text-sm truncate">{fullName}</p>
      {application.candidate.currentCompany && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {application.candidate.currentCompany}
        </p>
      )}
    </div>
  );
}

export function PipelineBoard({
  jobId,
  stages,
  applications,
  users = [],
  onMoveSuccess,
}: PipelineBoardProps) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Require 8px of movement before drag starts, preventing clicks from being treated as drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [movingApplication, setMovingApplication] = useState<Application | null>(null);
  const [movingTargetStageId, setMovingTargetStageId] = useState<string | null>(null);

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  const handleRecruiterChange = useCallback(
    async (applicationId: string, recruiterId: string | null) => {
      try {
        const res = await fetch(getApiUrl(`/api/applications/${applicationId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recruiterId }),
        });
        if (res.ok) router.refresh();
        else toast.error("Failed to update recruiter.");
      } catch {
        toast.error("Failed to update recruiter.");
      }
    },
    [router]
  );

  const getApplicationsForStage = useCallback(
    (stageId: string) => {
      return applications.filter((a) => a.currentStageId === stageId);
    },
    [applications]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const application = applications.find((a) => a.id === active.id);
      if (!application || application.currentStageId === over.id) return;

      setMovingApplication(application);
      setMovingTargetStageId(over.id as string);

      try {
        const res = await fetch(getApiUrl("/api/applications/move"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: application.id,
            stageId: over.id,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to move application");
        }
        onMoveSuccess?.();
        router.refresh();
      } catch {
        toast.error("Failed to move application. Please try again.");
      } finally {
        setMovingApplication(null);
        setMovingTargetStageId(null);
      }
    },
    [applications, onMoveSuccess, router]
  );

  const activeApplication = activeId
    ? applications.find((a) => a.id === activeId)
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {          sortedStages.map((stage) => (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              applications={getApplicationsForStage(stage.id)}
              movingApplication={movingApplication}
              movingTargetStageId={movingTargetStageId}
              users={users}
              onRecruiterChange={handleRecruiterChange}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeApplication ? (
          <OverlayCard application={activeApplication} />
        ) : null}
      </DragOverlay>

    </DndContext>
  );
}

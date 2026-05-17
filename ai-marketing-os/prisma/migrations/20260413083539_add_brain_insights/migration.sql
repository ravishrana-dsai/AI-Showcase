-- AlterTable
ALTER TABLE "agent_outputs" ADD COLUMN     "extractionStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "brain_insights" (
    "id" TEXT NOT NULL,
    "sourceOutputId" TEXT NOT NULL,
    "sourceAgentTab" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "routedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_insights_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "brain_insights" ADD CONSTRAINT "brain_insights_sourceOutputId_fkey" FOREIGN KEY ("sourceOutputId") REFERENCES "agent_outputs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "context_inputs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_bibles" (
    "id" TEXT NOT NULL,
    "voicePrinciples" TEXT[],
    "taglines" TEXT[],
    "brandPositioning" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_bibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_history" (
    "id" TEXT NOT NULL,
    "agentTab" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "outputPreview" TEXT NOT NULL,
    "engagementScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_intel" (
    "id" TEXT NOT NULL,
    "segmentName" TEXT NOT NULL,
    "insights" JSONB NOT NULL,
    "trendingTopics" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_intel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_memory" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followers" INTEGER,
    "lastInteraction" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_outputs" (
    "id" TEXT NOT NULL,
    "agentTab" TEXT NOT NULL,
    "inputPrompt" TEXT NOT NULL,
    "outputContent" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_cost_logs" (
    "id" TEXT NOT NULL,
    "agentTab" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_cost_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "context_inputs_key_key" ON "context_inputs"("key");

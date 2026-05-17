interface DimensionScore {
  score: number;
  notes: string;
}

interface Scorecard {
  overall_score: number;
  recommendation: string;
  dimensions: {
    communication: DimensionScore;
    role_fit: DimensionScore;
    motivation: DimensionScore;
    culture_fit: DimensionScore;
    problem_solving: DimensionScore;
  };
  strengths: string[];
  concerns: string[];
  summary: string;
}

interface SlackNotificationParams {
  interviewId: string;
  candidateName: string;
  roleName: string;
  scorecard: Scorecard;
  adminUrl: string;
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_pass: "STRONG PASS",
  pass: "PASS",
  hold: "HOLD",
  reject: "REJECT",
};

export async function sendInterviewCompleteNotification(
  params: SlackNotificationParams
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL not set — skipping notification");
    return;
  }

  const { interviewId, candidateName, roleName, scorecard, adminUrl } = params;
  const { overall_score, recommendation, dimensions, strengths, concerns, summary } =
    scorecard;

  const recLabel = RECOMMENDATION_LABELS[recommendation] ?? recommendation.toUpperCase();
  const concernsText = concerns.length > 0 ? concerns.join(", ") : "None";
  const strengthsText = strengths.join(", ");

  const text = [
    `*Interview Complete — ${candidateName}*`,
    `Role: ${roleName}`,
    `Score: ${overall_score}/10 — *${recLabel}*`,
    "",
    "*Dimension Scores:*",
    `• Communication: ${dimensions.communication.score}/10`,
    `• Role Fit: ${dimensions.role_fit.score}/10`,
    `• Motivation: ${dimensions.motivation.score}/10`,
    `• Culture Fit: ${dimensions.culture_fit.score}/10`,
    `• Problem Solving: ${dimensions.problem_solving.score}/10`,
    "",
    `*Summary:*\n${summary}`,
    "",
    `*Key Concerns:* ${concernsText}`,
    `*Strengths:* ${strengthsText}`,
    "",
    `<${adminUrl}/admin/interviews/${interviewId}|View Full Scorecard>`,
  ].join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${body}`);
  }
}

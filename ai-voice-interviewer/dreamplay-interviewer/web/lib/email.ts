interface SendInterviewLinkParams {
  candidateName: string;
  candidateEmail: string;
  roleName: string;
  interviewLink: string;
}

export async function sendInterviewLinkEmail(
  params: SendInterviewLinkParams
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping interview link email");
    return;
  }

  const { candidateName, candidateEmail, roleName, interviewLink } = params;
  const fromEmail = process.env.EMAIL_FROM ?? "interviews@[company-domain]";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://[company-domain]";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1117;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#181C27;border:1px solid #2A2F3D;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;border-bottom:1px solid #2A2F3D;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00C2FF;margin-right:8px;vertical-align:middle;"></span>
              <span style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8B93A8;vertical-align:middle;">[Company]</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#F0F4FF;">Hi ${candidateName},</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#8B93A8;line-height:1.6;">
                You have been invited to complete a first-round interview for the
                <strong style="color:#F0F4FF;">${roleName}</strong> role at [Company].
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#8B93A8;line-height:1.6;">
                The interview is conducted by Aria, our AI interviewer. It covers 6 questions
                and takes approximately 15 to 20 minutes. You will need a microphone and a quiet space.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#00C2FF;border-radius:10px;">
                    <a href="${interviewLink}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#000;text-decoration:none;">
                      Start My Interview
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#4A5168;">Or copy this link into your browser:</p>
              <p style="margin:0 0 28px;font-size:12px;color:#00C2FF;word-break:break-all;font-family:monospace;background:#1F2433;padding:10px 12px;border-radius:8px;border:1px solid #2A2F3D;">
                ${interviewLink}
              </p>
              <p style="margin:0;font-size:13px;color:#4A5168;line-height:1.6;">
                This link is unique to you and does not expire. If you have any questions, reply to this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #2A2F3D;">
              <p style="margin:0;font-size:12px;color:#4A5168;">
                [Company] &mdash; AI-powered sports video intelligence
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [candidateEmail],
      subject: `Your [Company] interview — ${roleName}`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API failed: ${response.status} ${body}`);
  }
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TokenSense — AI Cost Intelligence",
  description: "Monitor and optimize your LLM API spend across Anthropic, Gemini, and OpenAI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}

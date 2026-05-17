import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Voice Interviewer",
  description: "AI-powered first-round interview for [Company]",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,   // prevents Safari zoom-on-focus breaking the layout
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

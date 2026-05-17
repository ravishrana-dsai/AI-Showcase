import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { ThemeScript } from "@/components/theme/theme-script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "[Company] AI - Applicant Tracking System",
  description:
    "Modern ATS for managing your entire hiring pipeline - from sourcing to offer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeScript />
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}

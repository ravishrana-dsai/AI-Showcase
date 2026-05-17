import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ProvidersPublic } from "@/components/providers-public";
import { Toaster } from "sonner";
import { ThemeScript } from "@/components/theme/theme-script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Careers",
  description: "Explore open roles and apply.",
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
        <ProvidersPublic>
          {children}
          <Toaster position="top-right" richColors />
        </ProvidersPublic>
      </body>
    </html>
  );
}

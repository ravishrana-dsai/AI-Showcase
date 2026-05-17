import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idea to PRD to Feature",
  description: "Turn a PRD into a first version of the feature with design and code.",
};

// Inline script to apply dark class before first paint (prevents flash)
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}

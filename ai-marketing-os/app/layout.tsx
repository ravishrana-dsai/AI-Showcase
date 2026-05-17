import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '[Company] Marketing OS',
  description: 'AI-powered marketing operating system for [Company]',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#080C18] antialiased" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}

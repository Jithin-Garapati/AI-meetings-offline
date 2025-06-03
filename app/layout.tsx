import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider";
import { Github } from "lucide-react";

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Meeting Transcription & Notes",
  description: "Offline speech-to-text with AI-powered meeting summaries",
  icons: null,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid hsl(var(--border))', // Assumes theme variable for border
            position: 'sticky',
            top: 0,
            backgroundColor: 'hsl(var(--background))', // Assumes theme variable for background
            zIndex: 10,
            width: '100%'
          }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
              AI Meeting Notes
            </h1>
            <a
              href="https://github.com/Jithin-Garapati/AI-meetings-offline"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub Repository"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <Github className="w-7 h-7" />
            </a>
          </header>
          <main style={{ paddingTop: '1rem' }}> {/* Adjust padding as needed */}
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}

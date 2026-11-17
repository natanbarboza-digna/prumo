import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Prumo",
    template: "%s · Prumo",
  },
  description: "Objetivos, trilhas, rotina e PDI no mesmo prumo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes changes the class on <html> before React hydrates, so the
    // warning about that attribute mismatch is expected and suppressed here.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            href="#conteudo"
            className="bg-background focus-visible:ring-ring sr-only rounded-md px-4 py-2 focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:ring-2"
          >
            Pular para o conteúdo
          </a>
          {/* The app's layout (src/app/(app)/layout.tsx) checks the session
              cookie before rendering anything; reading cookies is per-request
              data, which Next requires inside Suspense. */}
          <Suspense
            fallback={
              <div role="status" aria-live="polite" className="text-muted-foreground p-8">
                Carregando…
              </div>
            }
          >
            {children}
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}

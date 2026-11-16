import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { MainNav } from "@/components/main-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

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
    default: "Gestão Pessoal",
    template: "%s · Gestão Pessoal",
  },
  description: "Objetivos, trilhas, rotina e PDI em um só lugar.",
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
          <header className="border-b">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
              <Link href="/" className="font-semibold">
                Gestão Pessoal
              </Link>
              <MainNav />
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

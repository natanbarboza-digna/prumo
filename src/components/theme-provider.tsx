"use client";

// next-themes reads and writes localStorage and toggles a class on <html>,
// which only works in the browser, so the provider must be a Client Component.
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}

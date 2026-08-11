import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inforvio PM",
  description: "Internal project management for Inforvio",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning is required by next-themes: it stamps
    // data-theme on <html> before React hydrates, which would otherwise
    // register as a mismatch.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

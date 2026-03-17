import { ReactNode } from "react";
import { headers } from "next/headers";

import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans, DM_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider } from "next-themes";
import { getWorkspaceBrandingForRequest } from "@/lib/workspace-context/branding";

import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500"],
});

function getRequestHostHeaderValue(hostHeader: string | null): string {
  if (!hostHeader) return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com";
  return hostHeader.split(":")[0]?.trim() || (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com");
}

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = getRequestHostHeaderValue(headerList.get("x-forwarded-host") ?? headerList.get("host"));
  const branding = await getWorkspaceBrandingForRequest();

  const metadataBase = new URL(`https://${host}`);
  const title = branding ? `${branding.name} – Portal` : APP_CONFIG.meta.title;
  const description = branding
    ? `${branding.name} workspace portal.`
    : APP_CONFIG.meta.description;
  const icon = branding?.faviconUrl || "/docsiv-icon.png";

  return {
    metadataBase,
    title,
    description,
    icons: {
      icon,
      apple: icon,
    },
    openGraph: {
      title,
      description,
      images: ["/opengraph.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph.png"],
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const branding = await getWorkspaceBrandingForRequest();

  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body
        className={`${playfair.variable} ${plusJakarta.variable} ${dmSans.variable} font-body min-h-screen antialiased`}
        style={{
          ["--brand-color" as string]: branding?.brandColor ?? "#0a0a0a",
          ["--brand" as string]: branding?.brandColor ?? "#0a0a0a",
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

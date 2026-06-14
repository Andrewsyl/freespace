import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../components/AuthProvider";
import { CookieBanner } from "../components/CookieBanner";
import { GoogleAuthProvider } from "../components/GoogleAuthProvider";
import { AppStatusProvider } from "../components/AppStatusProvider";
import { ClientTelemetry } from "../components/ClientTelemetry";
import { ToastProvider } from "../components/Toaster";
import Script from "next/script";
import { webEnv } from "../lib/env";

export const metadata: Metadata = {
  title: "FreeSpace",
  description: "Find and book parking in minutes",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B8A5A",
};

const buildSha =
  process.env.NEXT_PUBLIC_APP_BUILD_SHA ??
  process.env.AWS_COMMIT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  "dev";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900" data-build-sha={buildSha}>
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${webEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
        <GoogleAuthProvider>
          <AppStatusProvider>
            <AuthProvider>
              <ToastProvider>
                <ClientTelemetry />
                <main className="px-0 py-0 sm:px-0 sm:py-0 lg:px-0 lg:py-0">{children}</main>
                <CookieBanner />
              </ToastProvider>
            </AuthProvider>
          </AppStatusProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}

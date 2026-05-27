import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../components/AuthProvider";
import { CookieBanner } from "../components/CookieBanner";
import { GoogleAuthProvider } from "../components/GoogleAuthProvider";
import { AppStatusProvider } from "../components/AppStatusProvider";
import { ClientTelemetry } from "../components/ClientTelemetry";
import Script from "next/script";
import { webEnv } from "../lib/env";

export const metadata: Metadata = {
  title: "FreeSpace",
  description: "Find and book parking in minutes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900">
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${webEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
        <GoogleAuthProvider>
          <AppStatusProvider>
            <AuthProvider>
              <ClientTelemetry />
              <main className="px-0 py-0 sm:px-0 sm:py-0 lg:px-0 lg:py-0">{children}</main>
              <CookieBanner />
            </AuthProvider>
          </AppStatusProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}

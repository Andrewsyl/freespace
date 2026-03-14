import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../components/AuthProvider";
import { GoogleAuthProvider } from "../components/GoogleAuthProvider";
import { AppStatusProvider } from "../components/AppStatusProvider";
import Script from "next/script";

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
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
        <GoogleAuthProvider>
          <AppStatusProvider>
            <AuthProvider>
              <main className="px-0 py-0 sm:px-0 sm:py-0 lg:px-0 lg:py-0">{children}</main>
            </AuthProvider>
          </AppStatusProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}

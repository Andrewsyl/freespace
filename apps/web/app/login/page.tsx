"use client";

import { Suspense, useState } from "react";
import { type Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { requestVerification } from "../../lib/api";
import { TextField } from "../../components/ui";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-10 text-sm text-slate-600">Loading…</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { signIn, signInWithGoogle, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const redirect = () => {
    const next = searchParams.get("next");
    router.push((next || "/dashboard") as Route);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    try {
      await signIn(email, password);
      redirect();
    } catch {
      // error shown via AuthProvider
    }
  };

  const handleGoogle = async (credential: string) => {
    setNotice(null);
    try {
      await signInWithGoogle(credential);
      redirect();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-8">
      <div className="mx-auto max-w-md">
        <div className="space-y-3 text-center">
          <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto h-16 w-auto mix-blend-multiply sm:h-20" />
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-700">WELCOME BACK</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">Access your bookings and host dashboard.</p>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          {/* ── Google sign-in (primary / prominent) ── */}
          {googleClientId && (
            <div className="mb-5">
              <GoogleSignInButton
                text="signin_with"
                onSuccess={handleGoogle}
                onError={() => setNotice("Google sign-in failed. Try again.")}
              />
              <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or sign in with email
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          )}

          {/* ── Email / password form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              required
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              required
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="text-right">
              <Link href="/reset-password" className="text-sm font-semibold text-brand-700">
                Forgot password?
              </Link>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {notice}
              </div>
            )}

            <p className="text-center text-sm text-slate-600">
              No account?{" "}
              <Link href="/signup" className="font-semibold text-brand-700">
                Sign up
              </Link>
            </p>

            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={async () => {
                setNotice(null);
                try {
                  await requestVerification(email);
                  setNotice("Verification email sent (if the account exists).");
                } catch (err) {
                  setNotice(err instanceof Error ? err.message : "Could not send verification email");
                }
              }}
            >
              Resend verification email
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { type Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../components/AuthProvider";
import { requestVerification } from "../../lib/api";

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
  const [debug, setDebug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await signIn(email, password);
      setDebug(`Login success for ${email}`);
      const next = searchParams.get("next");
      router.push((next || "/dashboard") as Route);
    } catch {
      setDebug("Login failed; check console for details.");
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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <div className="text-right">
              <Link href="/reset-password" className="text-sm font-semibold text-brand-700">
                Forgot password?
              </Link>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
            {googleClientId && (
              <>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  or
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      if (!credentialResponse.credential) {
                        setNotice("Google sign-in failed. Try again.");
                        return;
                      }
                      try {
                        await signInWithGoogle(credentialResponse.credential);
                        const next = searchParams.get("next");
                        router.push((next || "/dashboard") as Route);
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Google sign-in failed.";
                        setNotice(msg);
                      }
                    }}
                    onError={() => setNotice("Google sign-in failed. Try again.")}
                    width="320"
                  />
                </div>
              </>
            )}
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
            {debug && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                {debug}
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
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={async () => {
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

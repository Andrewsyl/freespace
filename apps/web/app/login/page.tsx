"use client";

import { Suspense, useState } from "react";
import { type Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { requestVerification } from "../../lib/api";
import { TextField } from "../../components/ui";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { useToast } from "../../components/Toaster";
import { SlimNav } from "../../components/SlimNav";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-10 text-sm text-slate-600">Loading…</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { signIn, signInWithGoogle, loading, error, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const redirect = (name?: string | null) => {
    const next = searchParams.get("next");
    const greeting = name ? `Welcome back, ${name.split(" ")[0]}` : "Welcome back";
    showToast(greeting);
    router.push((next || "/") as Route);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    try {
      const signedInUser = await signIn(email, password);
      redirect(signedInUser?.name);
    } catch {
      // error shown via AuthProvider
    }
  };

  const handleGoogle = async (credential: string) => {
    setNotice(null);
    try {
      const signedInUser = await signInWithGoogle(credential);
      redirect(signedInUser?.name);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <SlimNav />
      <div className="flex flex-1 flex-col px-5 pb-10 pt-8">
      <div className="mx-auto w-full max-w-sm">

        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <img
            src="/freespace-logo-grid-black.png"
            alt="FreeSpace"
            className="mx-auto mb-6 h-10 w-auto mix-blend-multiply"
          />
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-[15px] text-slate-600">Sign in to your account</p>
        </div>

        {/* Google sign-in */}
        {googleClientId && (
          <div className="mb-4">
            <GoogleSignInButton
              text="signin_with"
              onSuccess={handleGoogle}
              onError={() => setNotice("Google sign-in failed. Try again.")}
            />
          </div>
        )}

        {/* Divider */}
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-[13px] font-medium text-slate-500">or</span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        {/* Email / password */}
        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="flex h-12 w-full items-center justify-center rounded-full border border-slate-200 bg-white text-[15px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Continue with email
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
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
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {/* Errors / notices */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {notice}
          </div>
        )}

        {/* Footer links */}
        <div className="mt-8 space-y-3 text-center text-[14px] text-slate-600">
          <p>
            No account?{" "}
            <Link href="/signup" className="font-semibold text-brand-700">
              Sign up
            </Link>
          </p>
          <button
            type="button"
            className="text-slate-600 underline underline-offset-2"
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
        </div>

      </div>
      </div>
    </div>
  );
}

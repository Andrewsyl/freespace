"use client";

import { Suspense, useState } from "react";
import { type Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { requestVerification } from "../../lib/api";
import { TextField } from "../../components/ui";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { useToast } from "../../components/Toaster";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}

const BENEFITS = [
  "Instant booking confirmation",
  "Flexible cancellation",
  "Secure payments via Stripe",
];

function LoginPageContent() {
  const { signIn, signInWithGoogle, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const redirect = (name?: string | null) => {
    const next = searchParams?.get("next");
    showToast(name ? `Welcome back, ${name.split(" ")[0]}` : "Welcome back");
    router.push((next || "/") as Route);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice(null);
    try {
      const u = await signIn(email, password);
      redirect(u?.name);
    } catch {
      // error shown via AuthProvider
    }
  };

  const handleGoogle = async (credential: string) => {
    setNotice(null);
    try {
      const u = await signInWithGoogle(credential);
      redirect(u?.name);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
    }
  };

  return (
    <div className="flex min-h-[100dvh]">

      {/* ── Left branding panel — lg+ ── */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] shrink-0 flex-col justify-between bg-brand-600 px-12 py-12">
        <Link href="/">
          <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-9 w-auto brightness-0 invert" />
        </Link>
        <div>
          <h2 className="text-[40px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
            Your parking<br />spot, sorted.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Thousands of spaces across Ireland. Book by the hour, day, or month.
          </p>
          <div className="mt-10 space-y-3.5">
            {BENEFITS.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
                </span>
                <span className="text-[14px] text-white/85">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-white/35">© {new Date().getFullYear()} FreeSpace</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden">
          <Link href="/">
            <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-8 w-auto" />
          </Link>
          <Link href="/signup" className="text-[13px] font-semibold text-brand-600">
            Sign up
          </Link>
        </div>

        {/* Form */}
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-[360px]">
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1 text-[15px] text-slate-500">Sign in to your account</p>

            <div className="mt-8 space-y-3">
              {googleClientId && (
                <GoogleSignInButton
                  text="signin_with"
                  onSuccess={handleGoogle}
                  onError={() => setNotice("Google sign-in failed. Try again.")}
                />
              )}

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-100" />
                <span className="text-[12px] font-medium text-slate-400">or</span>
                <span className="h-px flex-1 bg-slate-100" />
              </div>

              {!showEmailForm ? (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Continue with email
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <TextField required type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <TextField required type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <div className="text-right">
                    <Link href="/reset-password" className="text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                      Forgot password?
                    </Link>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-[14px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                {notice}
              </div>
            )}

            <div className="mt-8 space-y-3 text-center">
              <p className="text-[13px] text-slate-500">
                No account?{" "}
                <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
                  Sign up free
                </Link>
              </p>
              <button
                type="button"
                className="text-[12px] text-slate-400 underline underline-offset-2 transition hover:text-slate-600"
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

    </div>
  );
}

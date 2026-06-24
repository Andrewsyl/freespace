"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { requestPhoneVerification, verifyPhone } from "../../lib/api";
import { TextField } from "../../components/ui";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { useToast } from "../../components/Toaster";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <SignupPageContent />
    </Suspense>
  );
}

const BENEFITS = [
  "List a driveway, garage, or car park",
  "Earn while you're not using it",
  "Instant payouts via Stripe",
];

function SignupPageContent() {
  const { signUp, signInWithGoogle, loading, error, token, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const nextUrl = searchParams?.get("next") || "/";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"form" | "verify">("form");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await signUp(email, password, phone || undefined, firstName.trim() || undefined, lastName.trim() || undefined);
      if (phone.trim()) {
        const authToken = token ?? localStorage.getItem("auth_token") ?? undefined;
        setSmsLoading(true);
        try {
          await requestPhoneVerification(phone.trim(), authToken ?? undefined);
          setNotice("We sent a verification code to your phone.");
          setPhoneStep("verify");
        } catch (err) {
          setNotice(err instanceof Error ? err.message : "Could not send SMS verification.");
          router.push(nextUrl as any);
        } finally {
          setSmsLoading(false);
        }
      } else {
        showToast(firstName.trim() ? `Welcome, ${firstName.trim()}!` : "Account created — welcome!");
        router.push(nextUrl as any);
      }
    } catch {
      // errors handled in context
    }
  };

  const handleGoogle = async (credential: string) => {
    setNotice(null);
    try {
      await signInWithGoogle(credential);
      showToast("Welcome to FreeSpace!");
      router.push(nextUrl as any);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
    }
  };

  return (
    <div className="flex min-h-[100dvh]">

      {/* ── Left branding panel — lg+ ── */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] shrink-0 flex-col justify-between bg-slate-950 px-12 py-12">
        <Link href="/">
          <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-9 w-auto brightness-0 invert" />
        </Link>
        <div>
          <h2 className="text-[40px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
            Park anywhere.<br />
            <span className="text-brand-400">Earn from home.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Join thousands of drivers and hosts on Ireland&apos;s parking marketplace.
          </p>
          <div className="mt-10 space-y-3.5">
            {BENEFITS.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20">
                  <Check className="h-3 w-3 text-brand-400" strokeWidth={2.5} />
                </span>
                <span className="text-[14px] text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-slate-600">© {new Date().getFullYear()} FreeSpace</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 lg:hidden">
          <Link href="/">
            <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-8 w-auto" />
          </Link>
          <Link href="/login" className="text-[13px] font-semibold text-brand-600">
            Sign in
          </Link>
        </div>

        {/* Form */}
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-[360px]">

            {phoneStep === "verify" ? (
              /* ── SMS verification ── */
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Verify your phone</h1>
                <p className="mt-1 text-[15px] text-slate-500">
                  Enter the 6-digit code sent to <strong className="font-semibold text-slate-700">{phone}</strong>
                </p>
                <div className="mt-8 space-y-3">
                  <TextField
                    required
                    label="Verification code"
                    inputMode="numeric"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={smsLoading || !smsCode.trim()}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-[14px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        setSmsLoading(true);
                        const authToken = token ?? localStorage.getItem("auth_token") ?? undefined;
                        const res = await verifyPhone(smsCode.trim(), authToken ?? undefined);
                        if (res.user) setUser(res.user);
                        router.push(nextUrl as any);
                      } catch (err) {
                        setNotice(err instanceof Error ? err.message : "Verification failed.");
                      } finally {
                        setSmsLoading(false);
                      }
                    }}
                  >
                    {smsLoading ? "Verifying…" : "Verify phone"}
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 text-[13px] font-semibold text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                    onClick={async () => {
                      try {
                        setSmsLoading(true);
                        const authToken = token ?? localStorage.getItem("auth_token") ?? undefined;
                        await requestPhoneVerification(phone.trim(), authToken ?? undefined);
                        setNotice("Code resent.");
                      } catch (err) {
                        setNotice(err instanceof Error ? err.message : "Could not resend code.");
                      } finally {
                        setSmsLoading(false);
                      }
                    }}
                  >
                    Resend code
                  </button>
                </div>
              </div>
            ) : (
              /* ── Main sign-up form ── */
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Create account</h1>
                <p className="mt-1 text-[15px] text-slate-500">Book spaces or earn from your driveway</p>

                <div className="mt-8 space-y-3">
                  {googleClientId && (
                    <GoogleSignInButton
                      text="signup_with"
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
                      <div className="grid grid-cols-2 gap-3">
                        <TextField required label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                        <TextField required label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                      </div>
                      <TextField required type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      <TextField required type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <TextField
                        type="tel"
                        label="Phone (optional)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+353871234567"
                        hint="Use E.164 format, e.g. +353871234567"
                      />
                      <button
                        type="submit"
                        disabled={loading || smsLoading}
                        className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-[14px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                      >
                        {loading ? "Creating…" : "Create account"}
                      </button>
                    </form>
                  )}
                </div>

                <p className="mt-6 text-center text-[11.5px] leading-5 text-slate-400">
                  By signing up you agree to our{" "}
                  <Link href="/legal/parking-terms-liability" className="underline underline-offset-2 hover:text-slate-600">Terms</Link>
                  {" "}and{" "}
                  <Link href="/legal/privacy-policy" className="underline underline-offset-2 hover:text-slate-600">Privacy Policy</Link>.
                </p>
              </div>
            )}

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

            <p className="mt-6 text-center text-[13px] text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

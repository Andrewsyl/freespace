"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { requestPhoneVerification, verifyPhone } from "../../lib/api";
import { TextField } from "../../components/ui";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { useToast } from "../../components/Toaster";

export default function SignupPage() {
  const { signUp, signInWithGoogle, loading, error, token, setUser } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          const msg = err instanceof Error ? err.message : "Could not send SMS verification.";
          setNotice(msg);
          router.push("/dashboard");
        } finally {
          setSmsLoading(false);
        }
      } else {
        showToast(firstName.trim() ? `Welcome, ${firstName.trim()}!` : "Account created — welcome!");
        router.push("/");
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
      router.push("/");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Google sign-in failed. Try again.");
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white px-5 pb-10 pt-12">
      <div className="mx-auto w-full max-w-sm">

        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <img
            src="/freespace-logo.png"
            alt="FreeSpace"
            className="mx-auto mb-6 h-10 w-auto mix-blend-multiply"
          />
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Create account</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">Book spaces or earn from your driveway</p>
        </div>

        {phoneStep === "verify" ? (
          /* ── SMS verification step ── */
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[14px] text-slate-600">
              Enter the 6-digit code sent to <strong>{phone}</strong>
            </div>
            <TextField
              required
              label="Verification code"
              inputMode="numeric"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
            />
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              disabled={smsLoading || !smsCode.trim()}
              onClick={async () => {
                try {
                  setSmsLoading(true);
                  const authToken = token ?? localStorage.getItem("auth_token") ?? undefined;
                  const res = await verifyPhone(smsCode.trim(), authToken ?? undefined);
                  if (res.user) setUser(res.user);
                  router.push("/dashboard");
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Verification failed.";
                  setNotice(msg);
                } finally {
                  setSmsLoading(false);
                }
              }}
            >
              {smsLoading ? "Verifying…" : "Verify phone"}
            </button>
            <button
              type="button"
              className="w-full py-2 text-[14px] font-semibold text-slate-500 underline underline-offset-2"
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
        ) : (
          <>
            {/* Google sign-up */}
            {googleClientId && (
              <div className="mb-4">
                <GoogleSignInButton
                  text="signup_with"
                  onSuccess={handleGoogle}
                  onError={() => setNotice("Google sign-in failed. Try again.")}
                />
              </div>
            )}

            {/* Divider */}
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-[13px] font-medium text-slate-400">or</span>
              <span className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Email form */}
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
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    required
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                  <TextField
                    required
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
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
                  className="flex h-12 w-full items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                  disabled={loading || smsLoading}
                >
                  {loading ? "Creating…" : "Create account"}
                </button>
              </form>
            )}
          </>
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

        {/* Footer */}
        <p className="mt-8 text-center text-[14px] text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}

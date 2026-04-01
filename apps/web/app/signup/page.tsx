"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../components/AuthProvider";
import { requestPhoneVerification, verifyPhone } from "../../lib/api";
import { TextField } from "../../components/ui";

export default function SignupPage() {
  const { signUp, signInWithGoogle, loading, error, token, setUser } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"form" | "verify">("form");
  const [smsLoading, setSmsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await signUp(email, password, phone || undefined);
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
        setNotice("Account created. Check your email to verify your address.");
        router.push("/dashboard");
      }
    } catch {
      // errors handled in context
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 pb-12 pt-8">
      <div className="mx-auto max-w-md">
        <div className="space-y-3 text-center">
          <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto h-16 w-auto mix-blend-multiply sm:h-20" />
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-700">HOST OR DRIVER</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create account</h1>
          <p className="text-sm text-slate-600">Book spaces or start earning from your driveway.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {phoneStep === "form" && (
              <>
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
                <button type="submit" className="btn-primary w-full" disabled={loading || smsLoading}>
                  {loading ? "Creating..." : "Create account"}
                </button>
              </>
            )}

            {phoneStep === "verify" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  Enter the 6-digit code sent to {phone}.
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
                  className="btn-primary w-full"
                  disabled={smsLoading || !smsCode.trim()}
                  onClick={async () => {
                    try {
                      setSmsLoading(true);
                      const authToken = token ?? localStorage.getItem("auth_token") ?? undefined;
                      const res = await verifyPhone(smsCode.trim(), authToken ?? undefined);
                      if (res.user) setUser(res.user);
                      setNotice("Phone verified. You're all set.");
                      router.push("/dashboard");
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Verification failed.";
                      setNotice(msg);
                    } finally {
                      setSmsLoading(false);
                    }
                  }}
                >
                  {smsLoading ? "Verifying..." : "Verify phone"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
                  onClick={async () => {
                    try {
                      setSmsLoading(true);
                      const authToken = token ?? localStorage.getItem("auth_token") ?? undefined;
                      await requestPhoneVerification(phone.trim(), authToken ?? undefined);
                      setNotice("Code resent.");
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Could not resend code.";
                      setNotice(msg);
                    } finally {
                      setSmsLoading(false);
                    }
                  }}
                >
                  Resend code
                </button>
              </div>
            )}
            {phoneStep === "form" && googleClientId && (
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
                        router.push("/dashboard");
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
            <p className="text-center text-sm text-slate-600">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-brand-700">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

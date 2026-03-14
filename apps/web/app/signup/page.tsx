"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../components/AuthProvider";

export default function SignupPage() {
  const { signUp, signInWithGoogle, loading, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await signUp(email, password);
      setNotice("Account created. Check your email to verify your address.");
      router.push("/dashboard");
    } catch {
      // errors handled in context
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-3 text-center">
        <img src="/freespace-logo.png" alt="FreeSpace" className="mx-auto h-20 w-auto mix-blend-multiply" />
        <p className="text-sm font-semibold tracking-wide text-brand-700">Host or driver</p>
        <h1 className="text-3xl tracking-tight font-semibold text-slate-900">Create account</h1>
        <p className="text-sm text-slate-600">Book spaces or start earning from your driveway.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
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
                    router.push("/dashboard");
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Google sign-in failed.";
                    setNotice(msg);
                  }
                }}
                onError={() => setNotice("Google sign-in failed. Try again.")}
              />
            </div>
          </>
        )}
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>}
        <p className="text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-brand-700">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

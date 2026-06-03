"use client";

import { useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { updateMe, requestPhoneVerification, verifyPhone } from "../../../lib/api";

export default function PersonalInfoPage() {
  const { user, token, setUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSaveName = async () => {
    if (!token) return;
    setSaving(true); setSuccess(null); setError(null);
    try {
      const res = await updateMe(token, { name: name.trim() || null });
      if (user) setUser({ ...user, ...res.user });
      setSuccess("Name updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  };

  const handleSendOtp = async () => {
    if (!token || !phone.trim()) return;
    setSendingOtp(true); setError(null);
    try {
      await requestPhoneVerification(phone.trim(), token);
      setOtpSent(true);
      setSuccess("Verification code sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally { setSendingOtp(false); }
  };

  const handleVerifyOtp = async () => {
    if (!token || !otp.trim()) return;
    setVerifying(true); setError(null);
    try {
      await verifyPhone(otp.trim(), token);
      if (user) setUser({ ...user, phone: phone.trim(), phoneVerified: true });
      setOtpSent(false);
      setOtp("");
      setSuccess("Phone number verified.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally { setVerifying(false); }
  };

  return (
    <div className="space-y-4 px-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Account</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Personal Info</h1>
      </div>

      {success && <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{success}</div>}
      {error   && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      {/* Name */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-bold text-slate-900">Display Name</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          onClick={handleSaveName}
          disabled={saving}
          className="mt-3 rounded-lg bg-brand-500 px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save name"}
        </button>
      </div>

      {/* Email (read-only) */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold text-slate-900">Email</h2>
        <p className="mb-3 text-[12.5px] text-slate-400">Email cannot be changed. Contact support if you need help.</p>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-[14px] text-slate-700">{user?.email}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${user?.emailVerified ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
            {user?.emailVerified ? "Verified" : "Unverified"}
          </span>
        </div>
      </div>

      {/* Phone */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">Phone Number</h2>
          {user?.phoneVerified && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">Verified</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setOtpSent(false); }}
            placeholder="+353 87 123 4567"
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={handleSendOtp}
            disabled={sendingOtp || !phone.trim()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {sendingOtp ? "Sending…" : otpSent ? "Resend" : "Verify"}
          </button>
        </div>
        {otpSent && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={verifying || otp.length < 4}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Confirm"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

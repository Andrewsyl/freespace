"use client";

import { useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { updateMe, requestPhoneVerification, verifyPhone } from "../../../lib/api";
import { PageHeader, TextField, Button } from "../../../components/ui";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Personal info"
        description="Manage how you appear to hosts and how we reach you."
      />

      {success && <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] font-medium text-brand-700">{success}</div>}
      {error   && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</div>}

      {/* Borderless sections, separated by hairlines — no boxes */}
      <div className="space-y-8">
        {/* Name */}
        <section>
          <h2 className="text-[14px] font-semibold text-slate-900">Display name</h2>
          <p className="mt-0.5 text-[13px] leading-[1.6] text-slate-500">The name hosts see on your bookings.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField
              wrapperClassName="flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Button onClick={handleSaveName} loading={saving} className="h-11 sm:w-auto" fullWidth>
              Save
            </Button>
          </div>
        </section>

        {/* Email */}
        <section className="border-t border-slate-200/70 pt-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Email</h2>
              <p className="mt-0.5 text-[13px] leading-[1.6] text-slate-500">Can&apos;t be changed. Contact support if you need help.</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${user?.emailVerified ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
              {user?.emailVerified ? "Verified" : "Unverified"}
            </span>
          </div>
          <p className="mt-3 text-[14px] font-medium text-slate-700">{user?.email}</p>
        </section>

        {/* Phone */}
        <section className="border-t border-slate-200/70 pt-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Phone number</h2>
              <p className="mt-0.5 text-[13px] leading-[1.6] text-slate-500">Used for booking updates and host contact.</p>
            </div>
            {user?.phoneVerified && (
              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">Verified</span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField
              wrapperClassName="flex-1"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setOtpSent(false); }}
              placeholder="+353 87 123 4567"
            />
            <Button
              variant="secondary"
              onClick={handleSendOtp}
              loading={sendingOtp}
              disabled={!phone.trim()}
              className="h-11 sm:w-auto"
              fullWidth
            >
              {otpSent ? "Resend" : "Verify"}
            </Button>
          </div>
          {otpSent && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <TextField
                wrapperClassName="flex-1"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
              <Button onClick={handleVerifyOtp} loading={verifying} disabled={otp.length < 4} className="h-11 sm:w-auto" fullWidth>
                Confirm
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

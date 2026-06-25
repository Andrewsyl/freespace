"use client";

import { useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { changePassword, logoutAllSessions, deleteAccount } from "../../../lib/api";

export default function SecurityPage() {
  const { user, token, signOut } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutSuccess, setLogoutSuccess] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirmPw) { setPwError("Passwords do not match."); return; }
    if (next.length < 8)  { setPwError("Password must be at least 8 characters."); return; }
    if (!token) return;
    setPwSaving(true); setPwError(null); setPwSuccess(false);
    try {
      await changePassword(token, current, next);
      setPwSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Could not change password");
    } finally { setPwSaving(false); }
  };

  const handleLogoutAll = async () => {
    if (!token) return;
    setLogoutBusy(true);
    try {
      await logoutAllSessions(token);
      setLogoutSuccess(true);
      setTimeout(() => signOut(), 1500);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Could not sign out of all devices. Please try again.");
    } finally { setLogoutBusy(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete your account permanently? This cannot be undone.`)) return;
    if (!token) return;
    setDeleting(true); setDeleteError(null);
    try {
      await deleteAccount(token);
      signOut();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete account");
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500">Account</p>
        <h1 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-slate-900">Login &amp; security</h1>
      </div>

      {/* Borderless sections, separated by hairlines — no boxes */}
      <div className="space-y-8">
        {/* Change password */}
        <section>
          <h2 className="text-[14px] font-semibold text-slate-900">Change password</h2>
          {pwSuccess && <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">Password updated successfully.</div>}
          {pwError   && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{pwError}</div>}
          <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
            {[
              { label: "Current password", value: current, setter: setCurrent },
              { label: "New password",     value: next,    setter: setNext },
              { label: "Confirm password", value: confirmPw, setter: setConfirm },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="mb-1 block text-[12px] font-semibold text-slate-600">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {pwSaving ? "Saving…" : "Update password"}
            </button>
          </form>
        </section>

        {/* Sessions */}
        <section className="border-t border-slate-200/70 pt-8">
          <h2 className="text-[14px] font-semibold text-slate-900">Active sessions</h2>
          <p className="mt-1 text-[13px] leading-[1.6] text-slate-500">Sign out of all devices including this one.</p>
          {logoutSuccess && <p className="mt-2 text-[13px] font-semibold text-brand-600">Signed out everywhere. Redirecting…</p>}
          <button
            onClick={handleLogoutAll}
            disabled={logoutBusy || logoutSuccess}
            className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {logoutBusy ? "Signing out…" : "Sign out all devices"}
          </button>
        </section>

        {/* Danger zone — intentionally contained as a caution surface */}
        <section className="border-t border-slate-200/70 pt-8">
          <div className="rounded-2xl bg-rose-50/60 px-5 py-5 ring-1 ring-rose-200/70">
            <h2 className="text-[14px] font-semibold text-rose-700">Delete account</h2>
            <p className="mt-1 text-[13px] leading-[1.6] text-rose-600/90">Permanently removes your account, listings, and bookings. This can&apos;t be undone.</p>
            {deleteError && <p className="mt-2 text-[13px] text-rose-600">{deleteError}</p>}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-4 rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-[13.5px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

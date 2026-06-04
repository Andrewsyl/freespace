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
    <div className="space-y-4 px-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Account</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Login &amp; Security</h1>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-bold text-slate-900">Change Password</h2>
        {pwSuccess && <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">Password updated successfully.</div>}
        {pwError   && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{pwError}</div>}
        <form onSubmit={handleChangePassword} className="space-y-3">
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
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={pwSaving}
            className="rounded-lg bg-brand-500 px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {pwSaving ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>

      {/* Sessions */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-[15px] font-bold text-slate-900">Active Sessions</h2>
        <p className="mt-1 text-[13px] text-slate-600">Sign out of all devices including this one.</p>
        {logoutSuccess && <p className="mt-2 text-[13px] font-semibold text-brand-600">Signed out everywhere. Redirecting…</p>}
        <button
          onClick={handleLogoutAll}
          disabled={logoutBusy || logoutSuccess}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-5 py-2 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {logoutBusy ? "Signing out…" : "Sign out all devices"}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-rose-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-[15px] font-bold text-rose-600">Danger Zone</h2>
        <p className="mt-1 text-[13px] text-slate-600">Permanently removes your account, listings, and bookings.</p>
        {deleteError && <p className="mt-2 text-[13px] text-rose-600">{deleteError}</p>}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-5 py-2 text-[13.5px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </div>
  );
}

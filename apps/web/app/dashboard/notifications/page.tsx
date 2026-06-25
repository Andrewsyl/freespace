"use client";

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500">Settings</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-[-0.02em] text-slate-900">Notifications</h1>
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.16)]">
        <p className="text-[14px] font-semibold text-slate-600">Notification preferences</p>
        <p className="mt-1 text-[13px] text-slate-600">Push notifications are managed in the FreeSpace mobile app.</p>
        <p className="mt-3 text-[13px] text-slate-600">Email notifications for booking confirmations and updates are sent automatically to your registered email address.</p>
      </div>
    </div>
  );
}

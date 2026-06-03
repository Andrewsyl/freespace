"use client";

export default function NotificationsPage() {
  return (
    <div className="space-y-4 px-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Settings</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-slate-900">Notifications</h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        <p className="text-[14px] font-semibold text-slate-500">Notification preferences</p>
        <p className="mt-1 text-[13px] text-slate-400">Push notifications are managed in the FreeSpace mobile app.</p>
        <p className="mt-3 text-[13px] text-slate-400">Email notifications for booking confirmations and updates are sent automatically to your registered email address.</p>
      </div>
    </div>
  );
}

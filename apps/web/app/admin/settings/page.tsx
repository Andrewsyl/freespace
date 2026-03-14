"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { listAdminSettings, updateAdminSetting } from "../../../lib/api";

type SettingRow = {
  key: string;
  value: any;
  updated_by?: string | null;
  updated_at?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
};

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("{}");

  const load = async () => {
    if (!token) return;
    setError(null);
    try {
      const settings = await listAdminSettings(token);
      setRows(settings as SettingRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveSetting = async (key: string, rawValue: string) => {
    if (!token) return;
    setError(null);
    try {
      const value = rawValue.trim() ? JSON.parse(rawValue) : null;
      const updated = await updateAdminSetting(key, { value }, token);
      setRows((prev) => {
        const exists = prev.some((row) => row.key === key);
        if (!exists) return [...prev, updated];
        return prev.map((row) => (row.key === key ? updated : row));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
    }
  };

  const createSetting = async () => {
    if (!newKey.trim()) {
      setError("Key is required");
      return;
    }
    await saveSetting(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("{}");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-600">Platform configuration values.</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add setting</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr,2fr,auto]">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="key (e.g. platform_fee_percent)"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />
          <button
            onClick={createSetting}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.key}</p>
                <p className="text-xs text-slate-500">Updated {formatDate(row.updated_at)}</p>
              </div>
              <button
                onClick={() => saveSetting(row.key, JSON.stringify(row.value ?? null))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Save
              </button>
            </div>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              defaultValue={JSON.stringify(row.value ?? null, null, 2)}
              onBlur={(e) => saveSetting(row.key, e.target.value)}
              rows={4}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

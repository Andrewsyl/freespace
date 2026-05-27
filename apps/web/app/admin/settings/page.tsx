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

const FRAUD_FIELDS = [
  {
    key: "blocked_ips",
    label: "Blocked IPs",
    helper: "One per line. Exact IPs only.",
    type: "list",
  },
  {
    key: "blocked_emails",
    label: "Blocked emails",
    helper: "One per line. Lowercase is enforced.",
    type: "list",
    lowercase: true,
  },
  {
    key: "blocked_user_ids",
    label: "Blocked user IDs",
    helper: "One UUID per line.",
    type: "list",
  },
  {
    key: "min_account_age_minutes",
    label: "Minimum account age (minutes)",
    helper: "New users must wait this long before booking/hosting.",
    type: "number",
    defaultValue: 10,
  },
  {
    key: "max_bookings_per_day",
    label: "Max bookings per 24h",
    helper: "Per user limit for new bookings.",
    type: "number",
    defaultValue: 5,
  },
  {
    key: "max_amount_per_day_cents",
    label: "Max booking spend per 24h (cents)",
    helper: "Total booking amount cap per user.",
    type: "number",
    defaultValue: 200000,
  },
  {
    key: "payments_manual_review",
    label: "Manual review payments",
    helper: "Tag all new payments for review (no auto-block).",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "max_push_tokens_per_user",
    label: "Max push tokens per user",
    helper: "Limit total push tokens per account.",
    type: "number",
    defaultValue: 6,
  },
  {
    key: "max_devices_per_user",
    label: "Max devices per user",
    helper: "Limit unique device IDs per account.",
    type: "number",
    defaultValue: 3,
  },
] as const;

const FRAUD_MODE_OPTIONS = [
  { value: "monitor", label: "Monitor only (no blocks)" },
  { value: "warn", label: "Warn + log (no blocks)" },
  { value: "enforce", label: "Enforce (block suspicious activity)" },
] as const;

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
  const [fraudValues, setFraudValues] = useState<Record<string, string>>({});
  const [fraudMode, setFraudMode] = useState<string>("monitor");

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

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of FRAUD_FIELDS) {
      const existing = rows.find((row) => row.key === field.key)?.value;
      if (field.type === "list") {
        const list = Array.isArray(existing) ? existing : [];
        next[field.key] = list.filter((item) => typeof item === "string").join("\n");
      } else if (field.type === "boolean") {
        const value = typeof existing === "boolean" ? existing : field.defaultValue ?? false;
        next[field.key] = value ? "true" : "false";
      } else {
        const value = typeof existing === "number" ? existing : field.defaultValue ?? 0;
        next[field.key] = String(value);
      }
    }
    setFraudValues(next);
    const modeValue = rows.find((row) => row.key === "fraud_mode")?.value;
    if (typeof modeValue === "string") {
      setFraudMode(modeValue);
    }
  }, [rows]);

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

  const parseList = (value: string, lowercase = false) =>
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => (lowercase ? entry.toLowerCase() : entry));

  const saveFraudSetting = async (field: (typeof FRAUD_FIELDS)[number]) => {
    if (!token) return;
    setError(null);
    try {
      const raw = fraudValues[field.key] ?? "";
      const value =
        field.type === "list"
          ? parseList(raw, "lowercase" in field && field.lowercase)
          : field.type === "boolean"
            ? raw === "true"
            : Number(raw || field.defaultValue || 0);
      const updated = await updateAdminSetting(field.key, { value }, token);
      setRows((prev) => {
        const exists = prev.some((row) => row.key === field.key);
        if (!exists) return [...prev, updated];
        return prev.map((row) => (row.key === field.key ? updated : row));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update fraud settings");
    }
  };

  const saveFraudMode = async () => {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateAdminSetting("fraud_mode", { value: fraudMode }, token);
      setRows((prev) => {
        const exists = prev.some((row) => row.key === "fraud_mode");
        if (!exists) return [...prev, updated];
        return prev.map((row) => (row.key === "fraud_mode" ? updated : row));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update fraud mode");
    }
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Fraud controls</h2>
            <p className="text-xs text-slate-500">Changes apply in ~60 seconds.</p>
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Fraud mode</p>
                <p className="text-xs text-slate-500">Choose how strict fraud rules should be.</p>
              </div>
              <button
                onClick={saveFraudMode}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Save
              </button>
            </div>
            <select
              value={fraudMode}
              onChange={(e) => setFraudMode(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {FRAUD_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {FRAUD_FIELDS.map((field) => (
            <div key={field.key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                  <p className="text-xs text-slate-500">{field.helper}</p>
                </div>
                <button
                  onClick={() => saveFraudSetting(field)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Save
                </button>
              </div>
              {field.type === "list" ? (
                <textarea
                  value={fraudValues[field.key] ?? ""}
                  onChange={(e) => setFraudValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              ) : field.type === "boolean" ? (
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(fraudValues[field.key] ?? "false") === "true"}
                    onChange={(e) =>
                      setFraudValues((prev) => ({ ...prev, [field.key]: e.target.checked ? "true" : "false" }))
                    }
                  />
                  Enabled
                </label>
              ) : (
                <input
                  value={fraudValues[field.key] ?? ""}
                  onChange={(e) => setFraudValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  type="number"
                  min={0}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
          <div key={row.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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

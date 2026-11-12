"use client";

// Generic numeric settings editor for program thresholds / ROI assumptions.
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SettingField = { key: string; label: string; hint?: string; min: number; max: number; step?: number; prefix?: string; suffix?: string };

export function SettingsForm({
  settingKey,
  fields,
  initial,
  school,
}: {
  settingKey: "thresholds" | "roi";
  fields: SettingField[];
  initial: Record<string, number>;
  school?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)]))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const value = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]));
    const res = await fetch("/api/admin/program-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: settingKey, value, school: school || undefined }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setMsg({ ok: false, text: body?.error?.formErrors?.[0] ?? "Check the values — some are out of range." });
      return;
    }
    setMsg({ ok: true, text: `Saved for ${body.school === "*" ? "all schools (default)" : body.school}` });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="text-xs font-semibold text-slate-700">
            {f.label}
            <span className="mt-1 flex items-center gap-1">
              {f.prefix && <span className="text-sm text-slate-600">{f.prefix}</span>}
              <input
                type="number"
                required
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="input"
              />
              {f.suffix && <span className="text-sm text-slate-600">{f.suffix}</span>}
            </span>
            {f.hint && <span className="mt-0.5 block font-normal text-slate-500">{f.hint}</span>}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary min-h-[44px]">{busy ? "Saving…" : "Save"}</button>
        <span aria-live="polite" className={"text-xs " + (msg?.ok ? "text-emerald-700" : "text-red-700")}>{msg?.text ?? ""}</span>
      </div>
    </form>
  );
}

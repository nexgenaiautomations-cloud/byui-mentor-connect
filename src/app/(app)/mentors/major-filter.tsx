"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function MajorFilter({
  majors,
  selected,
}: {
  majors: string[];
  selected: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(value: string) {
    const next = new URLSearchParams(params?.toString());
    if (value) next.set("major", value);
    else next.delete("major");
    // Don't carry a stale "mine=1" — picking a major from the dropdown should
    // win over the "My major" shortcut.
    next.delete("mine");
    const qs = next.toString();
    router.push(`/mentors${qs ? `?${qs}` : ""}`);
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Major
      </span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-navy-700 shadow-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200 cursor-pointer"
        aria-label="Filter mentors by major"
      >
        <option value="">All majors</option>
        {majors.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}

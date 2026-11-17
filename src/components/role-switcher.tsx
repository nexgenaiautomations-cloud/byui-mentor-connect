"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setActiveRoleAction } from "@/lib/actions";
import { ROLE_LABELS, type ActiveRole } from "@/lib/roles";

// Picking a role in the menu does nothing until "Switch" is pressed.
// Changing context on select change failed WCAG 3.2.2 (On Input): a keyboard
// user arrowing through the options was sent to the dashboard on the first one.
export function RoleSwitcher({
  id,
  activeRole,
  availableRoles,
  onSwitched,
  textSize = "text-xs",
}: {
  id: string;
  activeRole: ActiveRole;
  availableRoles: ActiveRole[];
  onSwitched?: () => void;
  textSize?: "text-xs" | "text-sm";
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<ActiveRole>(activeRole);
  const [pending, startTransition] = useTransition();
  const changed = choice !== activeRole;

  return (
    <form
      className="mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return;
        startTransition(async () => {
          await setActiveRoleAction(choice);
          router.push("/dashboard");
          onSwitched?.();
        });
      }}
    >
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-wider text-white/70"
      >
        Active role
      </label>
      <div className="mt-1 flex gap-1.5">
        <select
          id={id}
          value={choice}
          disabled={pending}
          onChange={(e) => setChoice(e.target.value as ActiveRole)}
          className={`min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 ${textSize} font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 cursor-pointer`}
        >
          {availableRoles.map((r) => (
            <option key={r} value={r} className="text-slate-800">
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {changed && (
          <button
            type="submit"
            disabled={pending}
            className={`shrink-0 rounded-lg bg-white px-2.5 py-1.5 ${textSize} font-bold text-brand-dark transition hover:bg-brand-light focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 cursor-pointer`}
          >
            {pending ? "…" : "Switch"}
          </button>
        )}
      </div>
    </form>
  );
}

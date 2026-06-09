"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { passwordIssues } from "@/lib/password-validation";

const PRIOR_INTERNSHIPS = ["None", "1", "2", "3 or more"] as const;

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Typed number now — stored as a string locally so an empty input is
  // distinguishable from 0 ("" = unanswered, "0" = "I've done none yet").
  const [priorChats, setPriorChats] = useState<string>("");
  const [priorInternships, setPriorInternships] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function validate(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!email.trim().toLowerCase().endsWith("@byui.edu")) {
      return "Only @byui.edu emails are allowed.";
    }
    if (!firstName.trim() || !lastName.trim()) {
      return "First and last name are required.";
    }
    const pw = passwordIssues(password);
    if (pw.length) return pw[0];
    if (password !== confirm) return "Passwords don't match.";
    if (priorChats === "") {
      return "Please enter how many career chats you've done.";
    }
    const n = Number(priorChats);
    if (!Number.isInteger(n) || n < 0) {
      return "Career chat count must be a whole number, 0 or greater.";
    }
    if (!priorInternships) {
      return "Please select a prior internship-experience answer.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          priorCareerChats: priorChats,
          priorInternshipExperience: priorInternships,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Could not create your account.");
        return;
      }
      router.push(body.redirectTo || "/onboarding");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">BYU-I email</label>
        <input
          id="email"
          type="email"
          required
          placeholder="yourname@byui.edu"
          className="input"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="label">First name</label>
          <input
            id="firstName"
            type="text"
            required
            className="input"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="label">Last name</label>
          <input
            id="lastName"
            type="text"
            required
            className="input"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          type="password"
          required
          className="input"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          8+ characters with at least one letter and one number.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="label">Confirm password</label>
        <input
          id="confirm"
          type="password"
          required
          className="input"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <fieldset className="space-y-2 rounded-xl border border-byui-blue-light/40 bg-slate-50 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-byui-blue-dark">
          A bit about your experience
        </legend>
        <div>
          <label htmlFor="prior-chats" className="label">
            How many informational interviews or career chats have you done?
          </label>
          <input
            id="prior-chats"
            type="number"
            min={0}
            step={1}
            required
            inputMode="numeric"
            placeholder="Example: 5"
            className="input"
            value={priorChats}
            onChange={(e) => {
              // Block negatives + non-integers at the input layer too, in
              // addition to the validate() guard.
              const raw = e.target.value;
              if (raw === "") {
                setPriorChats("");
                return;
              }
              if (!/^\d+$/.test(raw)) return;
              setPriorChats(raw);
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            Enter the total number you have completed before joining BYUI CAN.
          </p>
        </div>
        <div>
          <label htmlFor="prior-intern" className="label">
            How many internships or career-related work experiences have you had?
          </label>
          <select
            id="prior-intern"
            required
            className="input"
            value={priorInternships}
            onChange={(e) => setPriorInternships(e.target.value)}
          >
            <option value="">Select…</option>
            {PRIOR_INTERNSHIPS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-[11px] text-slate-500">
        By creating an account you agree to receive transactional emails (sign-in
        links, password resets) from BYUI CAN.
      </p>
    </form>
  );
}

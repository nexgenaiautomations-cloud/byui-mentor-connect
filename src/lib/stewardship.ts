// Executive-mentor stewardship balancing (Shaun Franklin, 2026-11-09).
// Admins assign mentors to executive mentors by hand; "Suggest balance"
// proposes an even split that moves as few people as possible, which the
// admin can adjust before approving. Nothing auto-rebalances.

// mentorId -> executiveId (null = unassigned)
export type Assignments = Record<string, string | null>;

export function groupSizes(a: Assignments, executives: string[]): Record<string, number> {
  const sizes: Record<string, number> = Object.fromEntries(executives.map((e) => [e, 0]));
  for (const exec of Object.values(a)) if (exec && exec in sizes) sizes[exec] += 1;
  return sizes;
}

export function suggestBalance(executives: string[], mentors: string[], current: Assignments): Assignments {
  if (executives.length === 0) return Object.fromEntries(mentors.map((m) => [m, null]));
  const execSet = new Set(executives);
  const n = mentors.length;
  const k = executives.length;
  const base = Math.floor(n / k);
  let extra = n % k; // this many executives may hold base + 1

  // Keep current, valid assignments; group by executive in stable order.
  const groups = new Map<string, string[]>(executives.map((e) => [e, []]));
  const pool: string[] = [];
  for (const m of mentors) {
    const e = current[m];
    if (e && execSet.has(e)) groups.get(e)!.push(m);
    else pool.push(m);
  }

  // Largest groups get the "+1" slots first so they shed the fewest people.
  const capacity = new Map<string, number>();
  for (const e of [...executives].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length)) {
    capacity.set(e, base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
  }
  for (const e of executives) {
    const g = groups.get(e)!;
    while (g.length > capacity.get(e)!) pool.push(g.pop()!);
  }
  for (const m of pool) {
    const target = executives
      .filter((e) => groups.get(e)!.length < capacity.get(e)!)
      .sort((a, b) => groups.get(a)!.length - groups.get(b)!.length)[0];
    groups.get(target)!.push(m);
  }

  const result: Assignments = {};
  for (const [e, ms] of groups) for (const m of ms) result[m] = e;
  return result;
}

export function diffAssignments(before: Assignments, after: Assignments) {
  return Object.keys(after)
    .filter((m) => (before[m] ?? null) !== (after[m] ?? null))
    .map((m) => ({ mentorId: m, from: before[m] ?? null, to: after[m] ?? null }));
}

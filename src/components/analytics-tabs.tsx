import Link from "next/link";

const TABS = [
  { href: "/admin/analytics", label: "Activity" },
  { href: "/admin/analytics/executive", label: "Executive summary" },
  { href: "/admin/analytics/effectiveness", label: "Program effectiveness" },
  { href: "/admin/analytics/careers", label: "Career outcomes" },
  { href: "/admin/analytics/roi", label: "ROI" },
];

// Sub-navigation shared by every analytics view.
export function AnalyticsTabs({ current, query = "" }: { current: string; query?: string }) {
  return (
    <nav aria-label="Analytics views" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map((t) => {
          const on = t.href === current;
          return (
            <li key={t.href}>
              <Link
                href={query && t.href !== "/admin/analytics" ? `${t.href}?${query}` : t.href}
                aria-current={on ? "page" : undefined}
                className={
                  "inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-plum-500 " +
                  (on ? "bg-plum-700 text-white" : "text-plum-700 hover:bg-plum-50")
                }
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

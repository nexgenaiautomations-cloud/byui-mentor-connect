// Inline geometric badge icons for the Trophy Case. Eight visual variants
// rotated across the 14 achievements — every key has a deterministic icon
// based on a hash of the key string so the same achievement always renders
// the same shape.

type Variant = "trophy" | "spark" | "chat" | "network" | "briefcase" | "doc" | "mic" | "star";

const VARIANTS: Variant[] = [
  "trophy",
  "spark",
  "chat",
  "network",
  "briefcase",
  "doc",
  "mic",
  "star",
];

const ICON_BY_KEY: Record<string, Variant> = {
  first_career_task: "trophy",
  weekly_streak_starter: "spark",
  career_chat_starter: "chat",
  networking_builder: "network",
  internship_win: "briefcase",
  part_time_win: "briefcase",
  full_time_win: "briefcase",
  resume_builder: "doc",
  interview_ready: "mic",
  can_standard_keeper: "star",
  extra_mile: "spark",
  conversation_builder: "chat",
  career_momentum: "star",
  industry_breakthrough: "briefcase",
  profile_complete: "doc",
};

function pickVariant(key: string): Variant {
  if (ICON_BY_KEY[key]) return ICON_BY_KEY[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return VARIANTS[hash % VARIANTS.length];
}

export function TrophyBadge({
  achievementKey,
  earned,
  size = 56,
}: {
  achievementKey: string;
  earned: boolean;
  size?: number;
}) {
  const v = pickVariant(achievementKey);
  const stroke = earned ? "#FFFFFF" : "#94A3B8";
  const fill = earned ? "#FFFFFF" : "transparent";
  return (
    <div
      className={
        "flex items-center justify-center rounded-2xl " +
        (earned
          ? "bg-gradient-to-br from-byui-blue to-byui-blue-dark shadow-soft"
          : "bg-slate-100")
      }
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 32 32"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        fill="none"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {v === "trophy" && (
          <>
            <path d="M10 6h12v6a6 6 0 0 1-12 0V6z" />
            <path d="M10 9H6a3 3 0 0 0 4 5M22 9h4a3 3 0 0 1-4 5" />
            <path d="M13 22h6M11 26h10M16 18v4" />
          </>
        )}
        {v === "spark" && (
          <>
            <path d="M16 4v6M16 22v6M4 16h6M22 16h6M8 8l4 4M20 20l4 4M8 24l4-4M20 12l4-4" />
          </>
        )}
        {v === "chat" && (
          <>
            <path d="M6 8h20v14H14l-6 6V8z" />
            <path d="M11 14h10M11 18h6" />
          </>
        )}
        {v === "network" && (
          <>
            <circle cx="8" cy="10" r="3" fill={fill} />
            <circle cx="24" cy="10" r="3" fill={fill} />
            <circle cx="16" cy="24" r="3" fill={fill} />
            <path d="M10.5 12 14 22M21.5 12 18 22M11 10h10" />
          </>
        )}
        {v === "briefcase" && (
          <>
            <rect x="5" y="11" width="22" height="14" rx="2" />
            <path d="M12 11V8h8v3M5 17h22" />
          </>
        )}
        {v === "doc" && (
          <>
            <path d="M9 5h10l5 5v17H9V5z" />
            <path d="M19 5v5h5M13 16h8M13 20h8M13 24h5" />
          </>
        )}
        {v === "mic" && (
          <>
            <rect x="13" y="5" width="6" height="14" rx="3" fill={fill} />
            <path d="M9 16a7 7 0 0 0 14 0M16 23v4M12 27h8" />
          </>
        )}
        {v === "star" && (
          <path
            d="M16 4l3.5 7.2 8 1.2-5.8 5.6 1.4 8L16 22.4 9 26l1.4-8L4.6 12.4l8-1.2L16 4z"
            fill={fill}
          />
        )}
      </svg>
    </div>
  );
}

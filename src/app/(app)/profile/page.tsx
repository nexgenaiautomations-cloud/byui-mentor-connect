import { redirect } from "next/navigation";

// /profile is the legacy URL for what's now /settings — old bookmarks, emails,
// and dashboard links keep working without a 404.
export default function ProfilePage() {
  redirect("/settings");
}

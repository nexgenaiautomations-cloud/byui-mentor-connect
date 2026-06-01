import { redirect } from "next/navigation";

// Monthly check-in surface was retired. Any inbound link (bookmarks, old
// emails) lands users back on the dashboard rather than a dead route.
export default function CheckInPage() {
  redirect("/dashboard");
}

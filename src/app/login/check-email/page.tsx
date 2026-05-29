import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-navy-50 via-white to-white px-6">
      <div className="card max-w-md text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-navy-100 text-2xl">
          ✉
        </div>
        <h1 className="font-display text-2xl font-bold text-navy-800">Check your inbox</h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a magic link to your BYU-I email. Click it to finish signing in. The link
          expires in 15 minutes.
        </p>
        <Link href="/" className="btn-ghost mt-6 inline-flex">
          Back to home
        </Link>
      </div>
    </main>
  );
}

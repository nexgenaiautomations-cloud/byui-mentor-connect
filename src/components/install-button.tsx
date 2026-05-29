"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton({
  variant = "primary",
  label = "Install app",
}: {
  variant?: "primary" | "sidebar";
  label?: string;
}) {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  }

  if (installed) return null;
  if (!event) return null;

  if (variant === "sidebar") {
    return (
      <button
        onClick={install}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-100 cursor-pointer"
      >
        <DownloadIcon /> {label}
      </button>
    );
  }

  return (
    <button
      onClick={install}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 cursor-pointer"
    >
      <DownloadIcon /> {label}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

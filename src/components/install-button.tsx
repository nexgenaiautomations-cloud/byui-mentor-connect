"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop-chromium" | "firefox" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|Edg\/|Edge\//.test(ua)) return "desktop-chromium";
  return "other";
}

export function InstallButton({
  variant = "primary",
  label = "Install app",
  fallback = "hide",
}: {
  variant?: "primary" | "sidebar";
  label?: string;
  // hide → render nothing when native prompt isn't available (sidebar/landing).
  // instructions → render a "Show install steps" button + platform-specific
  // guidance when the native prompt isn't available (settings page).
  fallback?: "hide" | "instructions";
}) {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
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

  // Already installed — only surface a confirmation in the explicit settings
  // placement. Sidebar and landing stay quiet (the user clearly knows).
  if (installed) {
    if (fallback === "instructions") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
          <CheckIcon /> App installed
        </span>
      );
    }
    return null;
  }

  // Native install prompt available — preferred path.
  if (event) {
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

  // No native prompt available. iOS Safari, Firefox, and Chrome before
  // engagement criteria all land here. Settings page wants steps; the
  // ambient placements stay silent.
  if (fallback !== "instructions") return null;

  return (
    <div>
      <button
        onClick={() => setShowSteps((s) => !s)}
        aria-expanded={showSteps}
        className="inline-flex items-center gap-2 rounded-lg border border-byui-blue/30 bg-white px-4 py-2 text-sm font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
      >
        <DownloadIcon /> {showSteps ? "Hide install steps" : "Show install steps"}
      </button>
      {showSteps && (
        <div className="mt-3 rounded-xl border border-byui-blue-light/40 bg-byui-blue-light/10 p-4 text-sm text-slate-700">
          <InstallSteps platform={platform} />
        </div>
      )}
    </div>
  );
}

function InstallSteps({ platform }: { platform: Platform }) {
  if (platform === "ios") {
    return (
      <>
        <p className="font-semibold text-byui-blue-dark">On iPhone or iPad (Safari)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Tap the <strong>Share</strong> button at the bottom of the screen.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong> in the top-right corner.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          Must be Safari — Chrome on iOS can&apos;t add PWAs to the home screen.
        </p>
      </>
    );
  }
  if (platform === "android") {
    return (
      <>
        <p className="font-semibold text-byui-blue-dark">On Android (Chrome)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Tap the <strong>⋮</strong> menu in the top-right corner.</li>
          <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Confirm by tapping <strong>Install</strong>.</li>
        </ol>
      </>
    );
  }
  if (platform === "desktop-chromium") {
    return (
      <>
        <p className="font-semibold text-byui-blue-dark">On desktop (Chrome or Edge)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>
            Look for the install icon{" "}
            <span className="inline-flex items-center rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
              ⊕
            </span>{" "}
            on the right side of the address bar.
          </li>
          <li>Or open the <strong>⋮</strong> menu and choose <strong>Install BYUI CAN…</strong></li>
          <li>Click <strong>Install</strong> to confirm.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          If the install icon isn&apos;t there yet, browse the app for a minute — Chrome
          waits until you&apos;ve engaged with the page before offering install.
        </p>
      </>
    );
  }
  if (platform === "firefox") {
    return (
      <>
        <p className="font-semibold text-byui-blue-dark">Firefox</p>
        <p className="mt-2 text-sm">
          Firefox doesn&apos;t support installing this app on desktop. For the full
          experience, open BYUI CAN in <strong>Chrome</strong> or <strong>Edge</strong> and
          install from there. On Firefox for Android, tap the <strong>⋮</strong> menu →{" "}
          <strong>Install</strong>.
        </p>
      </>
    );
  }
  return (
    <>
      <p className="font-semibold text-byui-blue-dark">Install from your browser</p>
      <p className="mt-2 text-sm">
        Look for an <strong>Install</strong> or <strong>Add to Home Screen</strong> option in
        your browser&apos;s menu. The exact location varies by browser — Chrome and Edge
        offer the smoothest install experience.
      </p>
    </>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
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

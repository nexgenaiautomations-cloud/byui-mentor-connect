"use client";

// Microphone button that dictates into a text field via the browser's Web
// Speech API. Starts only when the user presses it, keeps no audio, and the
// text lands in the normal (editable) textarea. Browsers without the API
// get a short note and keep typing as usual.
import { useEffect, useRef, useState } from "react";
import {
  appendTranscript,
  dictationErrorMessage,
  getRecognitionCtor,
  type RecognitionLike,
} from "@/lib/dictation";

export function DictationButton({
  value,
  onChange,
  label = "Dictate",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<RecognitionLike | null>(null);
  // Latest value without re-binding the recognition handlers.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setSupported(getRecognitionCtor(typeof window === "undefined" ? undefined : window) !== null);
    return () => recRef.current?.abort();
  }, []);

  function start() {
    const Ctor = getRecognitionCtor(window);
    if (!Ctor) return;
    setError("");
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) {
          valueRef.current = appendTranscript(valueRef.current, text);
          onChange(valueRef.current);
        } else {
          pending += text;
        }
      }
      setInterim(pending);
    };
    rec.onerror = (e) => setError(dictationErrorMessage(e.error));
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError(dictationErrorMessage("unknown"));
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  if (supported === null) return null;
  if (!supported) {
    return (
      <p className="text-[11px] text-slate-500">
        Voice dictation isn&apos;t available in this browser — type your notes, or use your
        keyboard&apos;s microphone key.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className={
          "inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-plum-500 focus:ring-offset-2 " +
          (listening
            ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
            : "border-plum-200 bg-white text-plum-700 hover:bg-plum-50")
        }
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {listening ? (
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
          ) : (
            <>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </>
          )}
        </svg>
        {listening ? "Stop dictation" : label}
        {listening && <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500 motion-reduce:animate-none" aria-hidden />}
      </button>
      <p aria-live="polite" className="min-h-[1rem] text-[11px] italic text-slate-500">
        {listening ? interim || "Listening… speak normally, then review the text before saving." : ""}
      </p>
      {error && <p role="alert" className="text-[11px] text-red-700">{error}</p>}
      <p className="text-[11px] leading-snug text-slate-500">
        Nothing is recorded or saved as audio. Your browser turns speech into text — some browsers
        (such as Chrome and Safari) do this on the browser maker&apos;s servers.
      </p>
    </div>
  );
}

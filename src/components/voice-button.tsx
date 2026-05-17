"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useLang } from "@/components/lang-provider";

type Props = {
  onResult: (text: string) => void;
  className?: string;
};

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSRConstructor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return W.SpeechRecognition ?? W.webkitSpeechRecognition ?? null;
}

export function VoiceButton({ onResult, className = "" }: Props) {
  const { lang } = useLang();
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getSRConstructor() !== null);
  const recogRef = useRef<SR | null>(null);

  useEffect(() => {
    const Ctor = getSRConstructor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = false;
    r.lang = lang === "sv" ? "sv-SE" : "fi-FI";
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult(text);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        // already stopped
      }
    };
  }, [lang, onResult]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const r = recogRef.current;
        if (!r) return;
        if (listening) {
          r.stop();
          setListening(false);
        } else {
          try {
            r.start();
            setListening(true);
          } catch {
            // already started
          }
        }
      }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${
        listening ? "!border-rose-500 !bg-rose-50 !text-rose-600 animate-pulse dark:!bg-rose-950/30" : ""
      } ${className}`}
      aria-label={listening ? "Stop recording" : "Start recording"}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

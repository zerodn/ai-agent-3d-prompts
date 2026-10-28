import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorldStore } from "../../state/useWorldStore";
import { cx } from "../ui";

const STEPS = ["Booting simulation engine", "Building the office", "Waking up agents"];
const MIN_MS = 1100;

export function LoadingScreen() {
  const sceneReady = useWorldStore((s) => s.sceneReady);
  const [step, setStep] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timers = STEPS.map((_, i) => setTimeout(() => setStep((s) => Math.max(s, i + 1)), ((i + 1) * MIN_MS) / STEPS.length));
    return () => timers.forEach(clearTimeout);
  }, []);

  const done = sceneReady && step >= STEPS.length;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 500);
    return () => clearTimeout(t);
  }, [done]);

  if (gone) return null;
  return (
    <div
      className={cx("absolute inset-0 z-50 flex items-center justify-center bg-ink-950 transition-opacity duration-500", done ? "pointer-events-none opacity-0" : "opacity-100")}
      role="status"
      aria-live="polite"
    >
      <div className="w-72 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-signal to-[#a78bfa] font-bold text-ink-950">AW</div>
          <div>
            <p className="font-semibold">AI Agent World</p>
            <p className="text-[12px] text-warn">Simulation mode · no live inference</p>
          </div>
        </div>
        <ul className="space-y-2 text-[13px]">
          {STEPS.map((label, i) => (
            <li key={label} className={cx("flex items-center gap-2", i < step ? "text-mist-100" : "text-mist-500")}>
              <span className={cx("flex h-4 w-4 items-center justify-center rounded-full", i < step ? "bg-ok text-ink-950" : "border border-white/15")}>
                {i < step && <Check size={11} strokeWidth={3} />}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

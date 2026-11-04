import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "./i18n";

/**
 * Small "?" help bubble. Opens on hover, keyboard focus or tap (a plain `title` never shows on phones).
 * Escape, a tap outside or leaving with the mouse closes it.
 */
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  // Centered under the button by default; shift it back inside the screen when that would clip it.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!open || !el) return;
    el.style.setProperty("--shift", "0px");
    const { left, right } = el.getBoundingClientRect();
    const margin = 8;
    const shift = left < margin ? margin - left : right > innerWidth - margin ? innerWidth - margin - right : 0;
    el.style.setProperty("--shift", `${shift}px`);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span
      className="tip"
      ref={root}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tip-btn"
        aria-label={t("tip.help", { label })}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          // Hover already opened it on a mouse; a tap must not toggle it shut again.
          setOpen(true);
        }}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" id={id} className="tip-bubble" ref={bubble}>
          {children}
        </span>
      )}
    </span>
  );
}

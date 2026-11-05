import type { CardImage } from "@mtg-vault/shared";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";

/** The pointer can hover (a mouse or trackpad), as opposed to a phone or tablet where only taps exist. */
const canHover = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;

/** Where to draw the big image beside the thumbnail: to its right, or to its left when there is no room, kept inside the window. */
export function previewPosition(thumb: { left: number; right: number; top: number; height: number }, view: { width: number; height: number }, size = { width: 300, height: 418 }) {
  const gap = 12;
  const left = thumb.right + gap + size.width <= view.width ? thumb.right + gap : Math.max(gap, thumb.left - gap - size.width);
  const top = Math.min(Math.max(gap, thumb.top + thumb.height / 2 - size.height / 2), Math.max(gap, view.height - size.height - gap));
  return { left, top };
}

/**
 * A card thumbnail with a bigger view: on a computer the large image floats beside it while the pointer is over it;
 * on a phone, where there is no hover, an "enlarge" button next to it opens the card in a dialog. The button is
 * always there for the keyboard and screen readers.
 */
export function CardPreview({ name, image, className = "thumb-wrap" }: { name: string; image: CardImage | null; className?: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState<{ left: number; top: number } | null>(null);
  const [open, setOpen] = useState(false);

  return (
    // The pointer handlers sit on the whole box, not on the image: the enlarge button overlaps the image on a computer,
    // and moving onto it must not close the preview.
    <div
      className={className}
      ref={box}
      onMouseEnter={() => {
        if (!canHover() || !box.current) return;
        setFloating(previewPosition(box.current.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }));
      }}
      onMouseLeave={() => setFloating(null)}
    >
      {image ? (
        <img src={image.small} alt="" loading="lazy" />
      ) : (
        <div className="thumb-ph" aria-hidden="true" />
      )}
      {image && (
        <button type="button" className="enlarge" aria-label={t("preview.enlarge", { name })} title={t("preview.enlarge", { name })} onClick={() => setOpen(true)}>
          ⤢
        </button>
      )}
      {floating && image && <img className="floating-preview" style={floating} src={image.normal} alt="" aria-hidden="true" />}
      {open && image && <PreviewDialog name={name} image={image} onClose={() => setOpen(false)} />}
    </div>
  );
}

function PreviewDialog({ name, image, onClose }: { name: string; image: CardImage; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay center" role="dialog" aria-label={name} onClick={onClose}>
      <div className="preview-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" autoFocus aria-label={t("detail.close")} onClick={onClose}>
          ×
        </button>
        <img src={image.normal} alt={name} />
      </div>
    </div>
  );
}

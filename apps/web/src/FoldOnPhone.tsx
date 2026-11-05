import { useState, type ReactNode } from "react";

const WIDE = "(min-width: 1000px)";
const isWide = () => typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia(WIDE).matches;

/**
 * A section that is always open on a wide screen (it sits in a side column) and starts folded on a phone, where it
 * would push the cards far down the page. Without `matchMedia` (tests) it starts open.
 */
export function FoldOnPhone({ title, children }: { title: string; children: ReactNode }) {
  const [wide] = useState(isWide);
  return (
    <details className="fold" open={wide}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

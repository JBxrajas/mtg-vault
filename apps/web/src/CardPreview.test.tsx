// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardPreview, previewPosition } from "./CardPreview";
import { resetLocale } from "./i18n";
import { aCard } from "./test-utils";

afterEach(() => {
  vi.unstubAllGlobals();
  resetLocale();
});

const image = aCard().image;

describe("previewPosition", () => {
  const view = { width: 1000, height: 800 };
  it("puts the big image to the right of the thumbnail when it fits", () => {
    expect(previewPosition({ left: 100, right: 150, top: 300, height: 70 }, view).left).toBe(162);
  });
  it("goes to the left when there is no room on the right, and stays inside the window vertically", () => {
    const p = previewPosition({ left: 900, right: 950, top: 760, height: 70 }, view);
    expect(p.left).toBe(900 - 12 - 300);
    expect(p.top).toBe(800 - 418 - 12);
    expect(previewPosition({ left: 0, right: 50, top: 0, height: 70 }, view).top).toBe(12);
  });
});

describe("CardPreview", () => {
  it("opens the card large from its button, and closes it with Escape", async () => {
    render(<CardPreview name="Lightning Bolt" image={image} />);
    await userEvent.click(screen.getByRole("button", { name: "Enlarge Lightning Bolt" }));
    expect(screen.getByRole("dialog", { name: "Lightning Bolt" })).toBeInTheDocument();
    expect(screen.getByAltText("Lightning Bolt")).toHaveAttribute("src", image!.normal);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the big image while a mouse hovers the thumbnail, but not on a touch screen", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(hover: hover)" }));
    const { container, unmount } = render(<CardPreview name="Lightning Bolt" image={image} />);
    const thumb = container.querySelector("img")!;
    await userEvent.hover(thumb);
    expect(container.querySelector(".floating-preview")).toHaveAttribute("src", image!.normal);
    // Moving onto the enlarge button, which overlaps the image, keeps the preview open.
    await userEvent.hover(screen.getByRole("button", { name: "Enlarge Lightning Bolt" }));
    expect(container.querySelector(".floating-preview")).not.toBeNull();
    await userEvent.unhover(screen.getByRole("button", { name: "Enlarge Lightning Bolt" }));
    expect(container.querySelector(".floating-preview")).toBeNull();
    unmount();

    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const touch = render(<CardPreview name="Lightning Bolt" image={image} />);
    await userEvent.hover(touch.container.querySelector("img")!);
    expect(touch.container.querySelector(".floating-preview")).toBeNull();
  });

  it("has no enlarge button without an image", () => {
    render(<CardPreview name="Mystery" image={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

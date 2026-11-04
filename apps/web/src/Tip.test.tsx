// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tip } from "./Tip";

describe("Tip", () => {
  it("is closed until the button is tapped", async () => {
    render(<Tip label="finish">Foil is shiny.</Tip>);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Help: finish" });
    await userEvent.click(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Foil is shiny.");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("opens on hover", async () => {
    render(<Tip label="finish">Foil is shiny.</Tip>);
    await userEvent.hover(screen.getByRole("button", { name: "Help: finish" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await userEvent.unhover(screen.getByRole("button", { name: "Help: finish" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes with Escape and when tapping elsewhere", async () => {
    render(
      <>
        <Tip label="a">Text</Tip>
        <p>elsewhere</p>
      </>,
    );
    const button = screen.getByRole("button", { name: "Help: a" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.click(button);
    await userEvent.click(screen.getByText("elsewhere"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("links the bubble to the button for screen readers", async () => {
    render(<Tip label="a">Text</Tip>);
    const button = screen.getByRole("button", { name: "Help: a" });
    await userEvent.click(button);
    expect(button).toHaveAccessibleDescription("Text");
  });
});

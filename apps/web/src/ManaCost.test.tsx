// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManaCost, pipClass } from "./ManaCost";

describe("pipClass", () => {
  it.each([
    ["W", "pip-w"],
    ["U", "pip-u"],
    ["B", "pip-b"],
    ["R", "pip-r"],
    ["G", "pip-g"],
    ["2", "pip-n"],
    ["X", "pip-n"],
    ["C", "pip-n"],
    ["W/U", "pip-w"], // hybrid: the first colour
    ["R/P", "pip-r"], // Phyrexian
    ["2/G", "pip-g"], // two-generic hybrid
    ["r", "pip-r"],
  ])("%s -> %s", (symbol, expected) => {
    expect(pipClass(symbol)).toBe(expected);
  });
});

describe("ManaCost", () => {
  it("draws one pip per symbol and exposes the original text to screen readers", () => {
    render(<ManaCost cost="{2}{W/U}{R}" />);
    const cost = screen.getByRole("img", { name: "{2}{W/U}{R}" });
    expect(cost.querySelectorAll(".pip")).toHaveLength(3);
    expect([...cost.querySelectorAll(".pip")].map((p) => p.textContent)).toEqual(["2", "WU", "R"]);
    expect(cost.querySelectorAll(".pip-n, .pip-w, .pip-r")).toHaveLength(3);
  });

  it("renders nothing for a card without a cost", () => {
    const { container } = render(<ManaCost cost={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

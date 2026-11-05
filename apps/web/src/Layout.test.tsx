// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { fetchMe } = vi.hoisted(() => ({ fetchMe: vi.fn() }));
vi.mock("./auth", () => ({ fetchMe, logout: vi.fn() }));

import { Layout } from "./Layout";
import { aUser, renderPage } from "./test-utils";

describe("Layout", () => {
  it("shows the brand and a main navigation to search and the collection", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<Layout />);
    expect(await screen.findByRole("link", { name: /mtg.*vault/ })).toHaveAttribute("href", "/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(within(nav).getByRole("link", { name: "Collection" })).toHaveAttribute("href", "/collection");
  });

  it("marks the current page in the navigation", async () => {
    fetchMe.mockResolvedValue(aUser);
    renderPage(<Layout />, { path: "/collection" });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Collection" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Search" })).not.toHaveAttribute("aria-current");
  });

  it("shows the account area", async () => {
    fetchMe.mockResolvedValue(aUser);
    renderPage(<Layout />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

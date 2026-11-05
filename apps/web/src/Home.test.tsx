// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, searchCards } = vi.hoisted(() => ({ fetchMe: vi.fn(), searchCards: vi.fn() }));
vi.mock("./auth", () => ({ fetchMe }));
vi.mock("./api", () => ({ searchCards, fetchPrintings: vi.fn() }));

import { Home } from "./Home";
import { aUser, renderPage } from "./test-utils";

beforeEach(() => {
  fetchMe.mockReset();
  searchCards.mockReset();
  searchCards.mockResolvedValue([]);
});

describe("Home", () => {
  it("shows the landing page to a visitor", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<Home />);
    expect(await screen.findByRole("heading", { level: 1, name: /Know every card you own/ })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("shows the card search to someone who is signed in", async () => {
    fetchMe.mockResolvedValue(aUser);
    renderPage(<Home />);
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /Know every card you own/ })).not.toBeInTheDocument();
  });

  it("shows neither while it is still finding out who is there, so the wrong page does not flash", async () => {
    fetchMe.mockReturnValue(new Promise(() => {}));
    renderPage(<Home />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});

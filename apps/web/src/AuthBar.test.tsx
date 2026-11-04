// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, logout } = vi.hoisted(() => ({ fetchMe: vi.fn(), logout: vi.fn() }));
vi.mock("./auth", () => ({ fetchMe, logout }));

import { AuthBar } from "./AuthBar";
import { aUser, renderPage } from "./test-utils";

beforeEach(() => {
  fetchMe.mockReset();
  logout.mockReset();
});

describe("AuthBar", () => {
  it("offers to sign in when nobody is signed in", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<AuthBar />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows the user, a link to the collection and signs out", async () => {
    fetchMe.mockResolvedValueOnce(aUser).mockResolvedValue(null);
    renderPage(<AuthBar />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My collection" })).toHaveAttribute("href", "/collection");

    logout.mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});

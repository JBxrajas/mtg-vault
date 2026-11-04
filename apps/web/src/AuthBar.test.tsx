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

  it("shows the user and signs out", async () => {
    fetchMe.mockResolvedValueOnce(aUser).mockResolvedValue(null);
    renderPage(<AuthBar />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();

    logout.mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("forgets the previous account's cached data on sign-out but keeps the public card search", async () => {
    fetchMe.mockResolvedValueOnce(aUser).mockResolvedValue(null);
    const { queryClient } = renderPage(<AuthBar />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    queryClient.setQueryData(["collection"], [{ id: "i1" }]);
    queryClient.setQueryData(["decks"], [{ id: "d1" }]);
    queryClient.setQueryData(["cards", "search", "bolt"], [{ oracleId: "o1" }]);

    logout.mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();

    expect(queryClient.getQueryData(["collection"])).toBeUndefined();
    expect(queryClient.getQueryData(["decks"])).toBeUndefined();
    expect(queryClient.getQueryData(["cards", "search", "bolt"])).toBeDefined();
  });
});

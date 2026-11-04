// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe } = vi.hoisted(() => ({ fetchMe: vi.fn() }));
vi.mock("./auth", () => ({ fetchMe }));

import { aUser, renderPage } from "./test-utils";
import { Welcome } from "./Welcome";

beforeEach(() => {
  fetchMe.mockReset();
});

describe("Welcome", () => {
  it("pitches the account to visitors and links to registration", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<Welcome />);
    expect(await screen.findByText("Keep track of your Magic collection")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/login?mode=register");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("stays out of the way once signed in", async () => {
    fetchMe.mockResolvedValue(aUser);
    renderPage(<Welcome />);
    await vi.waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(screen.queryByText("Keep track of your Magic collection")).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { login, register } = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock("./auth", () => ({ login, register }));

import { LoginPage } from "./LoginPage";
import { renderPage } from "./test-utils";

beforeEach(() => {
  login.mockReset();
  register.mockReset();
});

const fill = async (username: string, password: string) => {
  await userEvent.type(await screen.findByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
};

describe("LoginPage", () => {
  it("signs in and goes back to the search", async () => {
    login.mockResolvedValue(undefined);
    const { queryClient } = renderPage(<LoginPage />, { path: "/login" });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await fill("alice", "correct horse");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));

    expect(login).toHaveBeenCalledWith({ username: "alice", password: "correct horse" });
    expect(await screen.findByText("route: /")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
  });

  it("shows the server's message and stays on the page when sign-in fails", async () => {
    login.mockRejectedValue(new Error("Invalid username or password"));
    renderPage(<LoginPage />, { path: "/login" });
    await fill("alice", "wrong");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
    expect(screen.queryByText("route: /")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("switches to account creation and validates before calling the API", async () => {
    renderPage(<LoginPage />, { path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "No account? Create one" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/3–30 characters/)).toBeInTheDocument();

    await fill("ab", "longenough");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3/i);
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects a short password and a username with forbidden characters", async () => {
    renderPage(<LoginPage />, { path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "No account? Create one" }));

    await fill("alice", "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8/i);

    await userEvent.clear(screen.getByLabelText("Username"));
    await userEvent.clear(screen.getByLabelText("Password"));
    await fill("bad name!", "longenough");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use letters, digits, underscore or dot");
    expect(register).not.toHaveBeenCalled();
  });

  it("creates the account and goes to the search", async () => {
    register.mockResolvedValue(undefined);
    renderPage(<LoginPage />, { path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "No account? Create one" }));
    await fill("Alice_1", "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(register).toHaveBeenCalledWith({ username: "Alice_1", password: "correct horse" });
    expect(await screen.findByText("route: /")).toBeInTheDocument();
  });
});

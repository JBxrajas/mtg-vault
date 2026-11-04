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

  it("opens on account creation when linked with ?mode=register", async () => {
    renderPage(<LoginPage />, { path: "/login?mode=register" , route: "/login" });
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/No email needed/)).toBeInTheDocument();
  });

  it("switches to account creation and validates before calling the API", async () => {
    renderPage(<LoginPage />, { path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "No account? Create one" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/3–30 characters/)).toBeInTheDocument();
    expect(screen.getByText(/No email needed/)).toBeInTheDocument();

    await fill("ab", "longenough");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3/i);
    expect(register).not.toHaveBeenCalled();
  });

  it("flags every wrong field at once, each under its own input", async () => {
    renderPage(<LoginPage />, { path: "/login?mode=register", route: "/login" });
    await fill("ab", "short");
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    const username = screen.getByLabelText("Username");
    const password = screen.getByLabelText("Password");
    expect(username).toBeInvalid();
    expect(password).toBeInvalid();
    expect(username).toHaveAccessibleDescription(/at least 3/i);
    expect(password).toHaveAccessibleDescription(/at least 8/i);

    // Fixing one field clears only its own error.
    await userEvent.type(username, "c");
    expect(username).toBeValid();
    expect(password).toBeInvalid();
    expect(register).not.toHaveBeenCalled();
  });

  it("says that emails are not used when the username has an @", async () => {
    renderPage(<LoginPage />, { path: "/login" });
    await fill("alice@example.com", "A1234567a_.");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("Username")).toHaveAccessibleDescription(/not an email/i);
    expect(screen.getByLabelText("Password")).toBeValid();
    expect(login).not.toHaveBeenCalled();
  });

  it("asks for the missing field when signing in with an empty form", async () => {
    renderPage(<LoginPage />, { path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("Username")).toHaveAccessibleDescription("Enter your username");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password");
    expect(login).not.toHaveBeenCalled();
  });

  it("puts a taken username under the username field, not in a loose message", async () => {
    register.mockRejectedValue(new Error("Username is already taken. Please try another."));
    renderPage(<LoginPage />, { path: "/login?mode=register", route: "/login" });
    await fill("alice", "A1234567a_.");
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(await screen.findByLabelText("Username")).toHaveAccessibleDescription(/already taken/i);
    expect(screen.getByLabelText("Username")).toBeInvalid();
    expect(screen.getByLabelText("Password")).toBeValid();
  });

  it("accepts the password A1234567a_. reported by a user", async () => {
    register.mockResolvedValue(undefined);
    renderPage(<LoginPage />, { path: "/login?mode=register", route: "/login" });
    await fill("feriii", "A1234567a_.");
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(register).toHaveBeenCalledWith({ username: "feriii", password: "A1234567a_." });
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
    expect(await screen.findByRole("alert")).toHaveTextContent("Use only letters, digits, underscore or dot");
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

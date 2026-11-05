// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe } = vi.hoisted(() => ({ fetchMe: vi.fn() }));
vi.mock("./auth", () => ({ fetchMe }));

import { setLocale } from "./i18n";
import { LandingPage } from "./LandingPage";
import { aUser, renderPage } from "./test-utils";

beforeEach(() => {
  fetchMe.mockReset();
  fetchMe.mockResolvedValue(null);
});
afterEach(() => setLocale("en"));

describe("LandingPage", () => {
  it("says what the app is for, with the ways in for a visitor", async () => {
    renderPage(<LandingPage />, { path: "/welcome" });
    expect(await screen.findByRole("heading", { level: 1, name: "Know every card you own. Build better decks." })).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: /Know every card/ });
    expect(within(hero).getByRole("link", { name: "Create your account" })).toHaveAttribute("href", "/login?mode=register");
    expect(within(hero).getByRole("link", { name: "Search cards" })).toHaveAttribute("href", "/search");
    expect(within(hero).getByRole("button", { name: "See how it works" })).toBeInTheDocument();
  });

  it("lists the features, the steps, and answers the questions a visitor would ask", async () => {
    renderPage(<LandingPage />, { path: "/welcome" });
    const features = await screen.findByRole("region", { name: "Everything for your cards, in one vault" });
    expect(within(features).getAllByRole("listitem")).toHaveLength(8);
    expect(within(features).getByRole("heading", { name: "Scan with your camera" })).toBeInTheDocument();
    const steps = screen.getByRole("region", { name: "How it works" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    const faq = screen.getByRole("region", { name: "Questions" });
    expect(within(faq).getAllByText(/\?$/)).toHaveLength(6);
    // Honest about what it is, and about the one claim that was only measured in a simulation.
    expect(within(faq).getByText(/not affiliated with or endorsed by Wizards of the Coast/)).toBeInTheDocument();
    expect(within(faq).getByText(/In a simulation with 120 cards/)).toBeInTheDocument();
    expect(screen.getByText(/unofficial fan project, not affiliated with Wizards of the Coast/)).toBeInTheDocument();
  });

  it("marks the sample screens as examples and hides them from screen readers", async () => {
    renderPage(<LandingPage />, { path: "/welcome" });
    await screen.findByRole("heading", { level: 1 });
    const examples = screen.getAllByText("Example");
    expect(examples).toHaveLength(3);
    for (const caption of examples) expect(caption.closest("figure")).toHaveAttribute("aria-hidden", "true");
  });

  it("takes someone who is signed in to their collection instead of asking them to register", async () => {
    fetchMe.mockResolvedValue(aUser);
    renderPage(<LandingPage />, { path: "/welcome" });
    const links = await screen.findAllByRole("link", { name: "Open my collection" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/collection");
    expect(screen.queryByRole("link", { name: "Create your account" })).not.toBeInTheDocument();
  });

  it("is in Spanish when the interface is", async () => {
    setLocale("es");
    renderPage(<LandingPage />, { path: "/welcome" });
    expect(await screen.findByRole("heading", { level: 1, name: "Conoce cada carta que tienes. Arma mejores mazos." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Crea tu cuenta" })).toHaveLength(2); // at the top and at the end
    expect(screen.getByText(/proyecto de aficionados, sin afiliación con Wizards of the Coast/)).toBeInTheDocument();
  });
});

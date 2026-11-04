// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, fetchCollection, searchCards, login, register } = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  fetchCollection: vi.fn(),
  searchCards: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));
vi.mock("./auth", () => ({ fetchMe, logout: vi.fn(), login, register }));
vi.mock("./collectionApi", () => ({
  fetchCollection,
  updateCollectionItem: vi.fn(),
  removeFromCollection: vi.fn(),
  importCollection: vi.fn(),
}));
vi.mock("./api", () => ({ searchCards, fetchPrintings: vi.fn() }));

import { CollectionPage } from "./CollectionPage";
import { formatUsd, priceLine } from "./format";
import { setLocale } from "./i18n";
import { Layout } from "./Layout";
import { LoginPage } from "./LoginPage";
import { SearchPage } from "./SearchPage";
import { aPrinting, aStack, aUser, renderPage } from "./test-utils";

beforeEach(() => {
  for (const f of [fetchMe, fetchCollection, searchCards, login, register]) f.mockReset();
  fetchMe.mockResolvedValue(aUser);
  searchCards.mockResolvedValue([]);
});

describe("Spanish UI", () => {
  it("the language button in the top bar switches the whole page and back", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<Layout />);
    const nav = within(await screen.findByRole("navigation", { name: "Main" }));
    expect(nav.getByRole("link", { name: "Collection" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", { name: "Colección" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");

    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("translates the collection, with plurals and prices in the local format", async () => {
    setLocale("es");
    fetchCollection.mockResolvedValue([aStack({ quantity: 1, unitPrice: 1234.5 }), aStack({ id: "i2", quantity: 2, unitPrice: 10 })]);
    renderPage(<CollectionPage />, { path: "/collection" });
    expect(await screen.findByRole("heading", { name: "Mi colección" })).toBeInTheDocument();
    expect(await screen.findByText("cartas")).toBeInTheDocument();
    expect(screen.getAllByText(/^grupos/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/c\/u/)[0]).toHaveTextContent("1234,50 US$ c/u");
    expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Una más" })).toHaveLength(2);
  });

  it("invites visitors to register, in Spanish", async () => {
    setLocale("es");
    fetchMe.mockResolvedValue(null);
    renderPage(<CollectionPage />, { path: "/collection" });
    expect(await screen.findByText("Tu colección, siempre a mano")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear una cuenta gratis" })).toHaveAttribute("href", "/login?mode=register");
  });

  it("says in Spanish which colors are being filtered and keeps the type filter value in English", async () => {
    setLocale("es");
    renderPage(<SearchPage />);
    expect(await screen.findByText("Ningún color elegido: cartas de cualquier color.")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("group", { name: "Identidad de color" })).getByRole("button", { name: "R" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Identidad de color" })).getByRole("button", { name: "G" }));
    expect(screen.getByText("Cartas que tienen todos estos: Rojo y Verde.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nombre de la carta"), "bolt");
    await userEvent.click(within(screen.getByRole("group", { name: "Tipos de carta comunes" })).getByRole("button", { name: "Conjuro" }));
    // The type line in the data is English, so the value sent is "Sorcery".
    expect(screen.getByLabelText("La línea de tipo contiene")).toHaveValue("Sorcery");
    await vi.waitFor(() => expect(searchCards).toHaveBeenLastCalledWith(expect.objectContaining({ type: "Sorcery" }), expect.anything()));
  });

  it("shows sign-up errors under their field in Spanish, and an @ gets the no-email hint", async () => {
    setLocale("es");
    renderPage(<LoginPage />, { path: "/login?mode=register", route: "/login" });
    await userEvent.type(await screen.findByLabelText("Usuario"), "ana@correo.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "corta");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(screen.getByLabelText("Usuario")).toHaveAccessibleDescription(/no se usan correos/);
    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription("Usa al menos 8 caracteres");
    expect(register).not.toHaveBeenCalled();
  });

  it("translates the server's known sign-in and sign-up errors, and shows unknown ones as they came", async () => {
    setLocale("es");
    login.mockRejectedValue(new Error("Invalid username or password"));
    renderPage(<LoginPage />, { path: "/login" });
    await userEvent.type(await screen.findByLabelText("Usuario"), "ana");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secreta123");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Usuario o contraseña incorrectos");

    login.mockRejectedValue(new Error("Too many attempts"));
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
  });

  it("formats prices for the language", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    setLocale("es");
    expect(formatUsd(1234.5)).toMatch(/^1\.?234,50\s?US\$$/);
    expect(priceLine({ usd: 1, usdFoil: 2, usdEtched: null, eur: 3, eurFoil: null, tix: null })).toContain("foil");
    expect(aPrinting().prices).toBeTruthy();
  });
});

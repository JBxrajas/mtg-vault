// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_RATE, formatMoney, parseCurrency, resetCurrency, setCurrency, getCurrency } from "./currency";
import { resetLocale } from "./i18n";

afterEach(() => {
  resetCurrency();
  resetLocale();
});

describe("parseCurrency", () => {
  it("keeps valid choices and falls back for anything else", () => {
    expect(parseCurrency({ currency: "MXN", rate: 17.25 })).toEqual({ currency: "MXN", rate: 17.25 });
    expect(parseCurrency({ currency: "EUR", rate: "x" })).toEqual({ currency: "USD", rate: DEFAULT_RATE });
    expect(parseCurrency({ currency: "MXN", rate: 0 })).toEqual({ currency: "MXN", rate: DEFAULT_RATE });
    expect(parseCurrency({ currency: "MXN", rate: 99999 }).rate).toBe(DEFAULT_RATE);
    expect(parseCurrency(null)).toEqual({ currency: "USD", rate: DEFAULT_RATE });
  });
});

describe("formatMoney", () => {
  it("shows dollars as they are and pesos at the chosen rate", () => {
    expect(formatMoney(10, { currency: "USD", rate: 18 })).toBe("$10.00");
    expect(formatMoney(10, { currency: "MXN", rate: 18.5 })).toBe("MX$185.00");
    expect(formatMoney(0, { currency: "MXN", rate: 18 })).toBe("MX$0.00");
  });
});

describe("setCurrency", () => {
  it("saves on this device, keeps the last valid rate when given a bad one", () => {
    setCurrency({ currency: "MXN", rate: 20 });
    expect(JSON.parse(localStorage.getItem("mtg-vault.currency")!)).toEqual({ currency: "MXN", rate: 20 });
    setCurrency({ rate: -3 });
    expect(getCurrency().rate).toBe(DEFAULT_RATE); // invalid: back to the default, never a broken value
  });
});

import { describe, expect, it } from "vitest";
import { countdown, fromLocalInput, toLocalInput } from "./auctionTime";

describe("auction times", () => {
  it("round-trips a datetime-local value through ISO in the device's time zone", () => {
    const iso = fromLocalInput("2026-11-26T22:59");
    expect(iso).toMatch(/Z$/);
    expect(toLocalInput(iso)).toBe("2026-11-26T22:59");
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("nope")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });

  it("counts down with days only when there are any", () => {
    const now = Date.parse("2026-11-25T20:00:00Z");
    expect(countdown("2026-11-27T01:02:03Z", now)).toBe("1d 05:02:03");
    expect(countdown("2026-11-25T20:09:05Z", now)).toBe("00:09:05");
    expect(countdown("2026-11-25T19:00:00Z", now)).toBe("");
    expect(countdown(null, now)).toBeNull();
  });
});

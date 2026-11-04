import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.js";

describe("parseCsv", () => {
  it("reads plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles CRLF, a final line without a newline, and blank lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("reads quoted fields with commas, doubled quotes and line breaks", () => {
    expect(parseCsv('"Name","Note"\n"Jace, the Mind Sculptor","say ""hi"""\n"two\nlines",x')).toEqual([
      ["Name", "Note"],
      ["Jace, the Mind Sculptor", 'say "hi"'],
      ["two\nlines", "x"],
    ]);
  });

  it("keeps empty fields, including a trailing one", () => {
    expect(parseCsv("a,,c,\n,,,")).toEqual([
      ["a", "", "c", ""],
      ["", "", "", ""],
    ]);
  });

  it("drops a leading byte-order mark", () => {
    expect(parseCsv("﻿Name,Count\nBolt,4")[0]).toEqual(["Name", "Count"]);
  });

  it("treats a quote in the middle of an unquoted field as text", () => {
    expect(parseCsv('5" tall,x')).toEqual([['5" tall', "x"]]);
  });

  it("returns nothing for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });
});

// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { importCollection } = vi.hoisted(() => ({ importCollection: vi.fn() }));
vi.mock("./collectionApi", () => ({ importCollection }));

import { ImportCollection } from "./ImportCollection";
import { renderPage } from "./test-utils";

const HEADER = '"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"';
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");
const line = (count: number, name: string, set = "lea", num = "1", proxy = "False", foil = "") =>
  `"${count}","0","${name}","${set}","Near Mint","English","${foil}","","2026-01-01","${num}","False","${proxy}",""`;

// Braces on purpose: a value returned from beforeEach is run by Vitest as a cleanup function.
beforeEach(() => {
  importCollection.mockReset();
});

/** Opens the panel and chooses a file with this content. */
async function choose(content: string, name = "collection.csv") {
  renderPage(<ImportCollection />);
  await userEvent.click(await screen.findByText("Import from CSV"));
  await userEvent.upload(screen.getByLabelText("CSV file"), new File([content], name, { type: "text/csv" }));
}

describe("ImportCollection", () => {
  it("explains that the import sets quantities and is safe to repeat", async () => {
    renderPage(<ImportCollection />);
    await userEvent.click(await screen.findByText("Import from CSV"));
    expect(screen.getByText(/importing the same file again/i)).toBeInTheDocument();
    expect(screen.getByText(/not in the file are left alone/i)).toBeInTheDocument();
  });

  it("previews the file: lines, total cards, skipped proxies and unused columns", async () => {
    await choose(csv(line(4, "Lightning Bolt"), line(2, "Counterspell", "ice", "64"), line(1, "Black Lotus", "lea", "232", "True")));
    expect(await screen.findByText(/2 lines, 6 cards ready to import \(1 proxy skipped\)/)).toBeInTheDocument();
    expect(screen.getByText("collection.csv")).toBeInTheDocument();
    expect(screen.getByText(/Columns not used: .*Last Modified/)).toBeInTheDocument();
    expect(importCollection).not.toHaveBeenCalled();
  });

  it("lists lines that cannot be read, before importing", async () => {
    await choose(csv(line(1, "Opt", "m21", "63"), `"x","0","Broken","lea","Near Mint","English","","","","1","False","False",""`));
    const details = (await screen.findByText(/Lines that cannot be read \(1\)/)).closest("details")!;
    await userEvent.click(within(details).getByText(/Lines that cannot be read/));
    expect(within(details).getByText(/Line 3/)).toBeInTheDocument();
    expect(within(details).getByText(/Broken: Count "x"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 1 line" })).toBeEnabled();
  });

  it("shows an error for a file that is not a collection export", async () => {
    await choose("Foo,Bar\n1,2", "notes.csv");
    expect(await screen.findByRole("alert")).toHaveTextContent(/No card name column/);
    expect(screen.queryByRole("button", { name: /Import \d/ })).not.toBeInTheDocument();
  });

  it("shows an error for an empty file", async () => {
    await choose("", "empty.csv");
    expect(await screen.findByRole("alert")).toHaveTextContent(/empty/i);
  });

  it("imports the rows and reports created, updated and unchanged stacks", async () => {
    importCollection.mockResolvedValue({ created: 3, updated: 1, unchanged: 2, adjusted: [], problems: [] });
    await choose(csv(line(4, "Lightning Bolt", "m10", "146"), line(1, "Opt", "m21", "63")));
    await userEvent.click(await screen.findByRole("button", { name: "Import 2 lines" }));

    expect(importCollection).toHaveBeenCalledTimes(1);
    const rows = importCollection.mock.calls[0]![0];
    expect(rows).toEqual([
      expect.objectContaining({ name: "Lightning Bolt", count: 4, setCode: "m10", collectorNumber: "146", finish: "nonfoil", condition: "NM" }),
      expect.objectContaining({ name: "Opt", count: 1, setCode: "m21", collectorNumber: "63" }),
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent("Done: 3 new, 1 updated, 2 already up to date.");
  });

  it("lists what was changed and what could not be imported", async () => {
    importCollection.mockResolvedValue({
      created: 1,
      updated: 0,
      unchanged: 0,
      adjusted: [{ line: 2, name: "Counterspell", reason: "This printing does not come in foil; imported as nonfoil" }],
      problems: [{ line: 3, name: "Nope", reason: "No card found in LEA #1" }],
    });
    await choose(csv(line(1, "Counterspell", "ice", "64", "False", "foil"), line(1, "Nope")));
    await userEvent.click(await screen.findByRole("button", { name: "Import 2 lines" }));

    const status = await screen.findByRole("status");
    await userEvent.click(within(status).getByText("Imported with a change (1)"));
    await userEvent.click(within(status).getByText("Not imported (1)"));
    expect(within(status).getByText(/imported as nonfoil/)).toBeInTheDocument();
    expect(within(status).getByText(/No card found in LEA #1/)).toBeInTheDocument();
  });

  it("shows progress while a big file is sent", async () => {
    let finish: (v: unknown) => void = () => undefined;
    importCollection.mockImplementation((_rows, onProgress) => {
      onProgress(500, 1200);
      return new Promise((resolve) => (finish = resolve));
    });
    await choose(csv(line(1, "A"), line(1, "B")));
    await userEvent.click(await screen.findByRole("button", { name: "Import 2 lines" }));
    expect(await screen.findByRole("button", { name: "Importing… 500 / 1200" })).toBeDisabled();
    finish({ created: 2, updated: 0, unchanged: 0, adjusted: [], problems: [] });
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("shows the server's message when the import fails", async () => {
    importCollection.mockRejectedValue(new Error("Internal server error"));
    await choose(csv(line(1, "Opt", "m21", "63")));
    await userEvent.click(await screen.findByRole("button", { name: "Import 1 line" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    // The file is still there to try again.
    expect(screen.getByRole("button", { name: "Import 1 line" })).toBeEnabled();
  });

  it("starts over when another file is chosen", async () => {
    importCollection.mockResolvedValue({ created: 1, updated: 0, unchanged: 0, adjusted: [], problems: [] });
    await choose(csv(line(1, "Opt", "m21", "63")));
    await userEvent.click(await screen.findByRole("button", { name: "Import 1 line" }));
    await screen.findByRole("status");
    await userEvent.upload(screen.getByLabelText("CSV file"), new File([csv(line(2, "Brainstorm"), line(1, "Ponder"))], "second.csv"));
    expect(await screen.findByText(/2 lines, 3 cards ready/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

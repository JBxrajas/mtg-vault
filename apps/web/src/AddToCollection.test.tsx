// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMe, addToCollection } = vi.hoisted(() => ({ fetchMe: vi.fn(), addToCollection: vi.fn() }));
vi.mock("./auth", () => ({ fetchMe }));
vi.mock("./collectionApi", () => ({ addToCollection }));

import { AddToCollection } from "./AddToCollection";
import { aPrinting, aStack, aUser, renderPage } from "./test-utils";

beforeEach(() => {
  fetchMe.mockReset();
  addToCollection.mockReset();
});

describe("AddToCollection", () => {
  it("asks to sign in when there is no session", async () => {
    fetchMe.mockResolvedValue(null);
    renderPage(<AddToCollection printing={aPrinting()} />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("only offers the finishes the printing comes in, with NM and 1 copy by default", async () => {
    fetchMe.mockResolvedValue(aUser);
    renderPage(<AddToCollection printing={aPrinting({ finishes: ["nonfoil", "foil"] })} />);
    const finish = await screen.findByLabelText("Finish");
    expect([...(finish as HTMLSelectElement).options].map((o) => o.value)).toEqual(["nonfoil", "foil"]);
    expect(screen.getByLabelText("Condition")).toHaveValue("NM");
    expect(screen.getByLabelText("Qty")).toHaveValue(1);
    expect(screen.getByText("Add Limited Edition Alpha (LEA) #161")).toBeInTheDocument();
  });

  it("adds the chosen finish, condition and quantity and confirms the new total", async () => {
    fetchMe.mockResolvedValue(aUser);
    addToCollection.mockResolvedValue(aStack({ quantity: 5, finish: "foil" }));
    renderPage(<AddToCollection printing={aPrinting({ id: "p9", finishes: ["nonfoil", "foil"] })} />);

    await userEvent.selectOptions(await screen.findByLabelText("Finish"), "foil");
    await userEvent.selectOptions(screen.getByLabelText("Condition"), "LP");
    await userEvent.clear(screen.getByLabelText("Qty"));
    await userEvent.type(screen.getByLabelText("Qty"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(addToCollection).toHaveBeenCalledWith({ printingId: "p9", quantity: 3, finish: "foil", condition: "LP" });
    expect(await screen.findByText(/You now own 5 of this exact copy/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My collection" })).toBeInTheDocument();
  });

  it("lets the quantity be cleared and retyped, and keeps what is sent inside 1..9999", async () => {
    fetchMe.mockResolvedValue(aUser);
    addToCollection.mockResolvedValue(aStack());
    renderPage(<AddToCollection printing={aPrinting()} />);
    const qty = await screen.findByLabelText("Qty");

    await userEvent.clear(qty);
    expect(qty).toHaveValue(null); // empty while typing, not forced back to 1
    await userEvent.type(qty, "99999");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(addToCollection).toHaveBeenLastCalledWith(expect.objectContaining({ quantity: 9999 }));
    expect(qty).toHaveValue(9999); // clamped on blur

    await userEvent.clear(qty);
    await userEvent.tab();
    expect(qty).toHaveValue(1);
  });

  it("shows the server's error", async () => {
    fetchMe.mockResolvedValue(aUser);
    addToCollection.mockRejectedValue(new Error("This printing does not come in foil"));
    renderPage(<AddToCollection printing={aPrinting()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Add" }));
    expect(await screen.findByText("This printing does not come in foil")).toBeInTheDocument();
  });
});

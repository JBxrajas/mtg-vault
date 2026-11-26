import type { AuctionBid, AuctionInput, AuctionUpdate } from "@mtg-vault/shared";
import { authedFetch } from "./authedFetch";

export async function fetchAuctions(): Promise<AuctionBid[]> {
  return ((await (await authedFetch("GET", "/auctions")).json()) as { bids: AuctionBid[] }).bids;
}

export async function createAuction(input: AuctionInput): Promise<AuctionBid> {
  return ((await (await authedFetch("POST", "/auctions", input)).json()) as { bid: AuctionBid }).bid;
}

export async function updateAuction(id: string, patch: AuctionUpdate): Promise<AuctionBid> {
  return ((await (await authedFetch("PATCH", `/auctions/${id}`, patch)).json()) as { bid: AuctionBid }).bid;
}

export async function deleteAuction(id: string): Promise<void> {
  await authedFetch("DELETE", `/auctions/${id}`);
}

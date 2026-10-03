/** Server public cutover view. Missing data stays open; an explicit false closes legacy login. */
export function legacyCustomerEntryAvailable(
  view: { legacyEntryAvailable?: boolean } | null | undefined,
): boolean {
  return view?.legacyEntryAvailable !== false;
}

/** Legacy customer login is shown only when the server explicitly leaves it open. */
export function legacyCustomerEntryAvailable(
  view: { legacyEntryAvailable?: boolean } | null | undefined,
): boolean {
  return view?.legacyEntryAvailable === true;
}

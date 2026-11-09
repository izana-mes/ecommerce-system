/** Next dynamic route params can retain the percent-escaped colon in catalog IDs. */
export function decodeCatalogId(value: string): string {
  let decoded = value;
  try {
    // Next may expose the escaped colon literally for a dynamic route param;
    // the detail page then escapes it again while building the API request.
    for (let pass = 0; pass < 2; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    return decoded;
  } catch {
    return decoded;
  }
}

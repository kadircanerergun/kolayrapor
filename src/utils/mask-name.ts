/**
 * Mask a patient's surname to its first character, e.g. "Selami" -> "S*****".
 * The first name is never masked, so a patient reads as "Name S*****".
 *
 * - The number of asterisks follows the length of the hidden part.
 * - Empty / whitespace input returns "".
 * - Values that already contain "*" are assumed masked and returned unchanged,
 *   so masking is safe to apply more than once (e.g. across repeated syncs).
 * - Multi-word surnames are masked token by token ("Demir Kaya" -> "D**** K***").
 *
 * Applied on the way out to the server and again on the way in for
 * cross-computer (synced) history records.
 */
export function maskSurname(surname?: string | null): string {
  const clean = (surname ?? "").trim();
  if (!clean) return "";
  if (clean.includes("*")) return clean;
  return clean
    .split(/\s+/)
    .map((token) => token[0] + "*".repeat(Math.max(token.length - 1, 1)))
    .join(" ");
}

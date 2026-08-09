/**
 * Mask a patient name to its first two characters for privacy, e.g.
 * "AHMET" -> "AH***", "SELAMİ" -> "SE***". Multi-word values are masked
 * token by token ("AHMET SELAMİ" -> "AH*** SE***").
 *
 * - Empty / whitespace input returns "".
 * - Values that already contain "*" are assumed masked and returned unchanged,
 *   so masking is safe to apply more than once (e.g. across repeated syncs).
 *
 * Used for cross-computer (synced) history records where the full patient name
 * must not be shown.
 */
export function maskName(name?: string | null): string {
  const clean = (name ?? "").trim();
  if (!clean) return "";
  if (clean.includes("*")) return clean;
  return clean
    .split(/\s+/)
    .map((token) =>
      token.length <= 2 ? `${token}***` : `${token.slice(0, 2)}***`,
    )
    .join(" ");
}

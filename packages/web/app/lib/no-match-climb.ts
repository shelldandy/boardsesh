/**
 * Returns `true` when a climb is marked as "no matching".
 *
 * In the Aurora climbing API, setters indicate "no matching" by prefixing the
 * climb description with "No matching." — the same convention used by Climbdex.
 */
export function isNoMatchClimb(description: string | undefined | null): boolean {
  return !!description && description.startsWith('No matching.');
}

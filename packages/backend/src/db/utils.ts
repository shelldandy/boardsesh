/**
 * Extract rows from a db.execute() result.
 * Neon serverless returns { rows: [...] }, postgres-js returns an array directly.
 */
export function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

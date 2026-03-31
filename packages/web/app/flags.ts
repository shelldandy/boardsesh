import { flag, evaluate, combine } from 'flags/next';
import { vercelAdapter } from '@flags-sdk/vercel';

// Only use the Vercel adapter when the FLAGS env var is available (set automatically
// on Vercel). Locally, flags fall through to their decide() functions.
const adapter = process.env.FLAGS ? vercelAdapter() : undefined;

export const rustSvgRendering = flag({
  key: 'rust-svg-rendering',
  adapter,
  defaultValue: false,
  description: 'Use Rust WASM renderer for board overlays instead of SVG',
  options: [
    { value: true, label: 'Enabled' },
    { value: false, label: 'Disabled' },
  ],
  decide() {
    return false;
  },
});

// Add new flags above this line, then add them to allFlags below.
export const allFlags = [rustSvgRendering] as const;

type FlagTuple = typeof allFlags;
export type FeatureFlags = {
  [K in FlagTuple[number] as K['key']]: Awaited<ReturnType<K>>;
};

export async function evaluateAllFlags(): Promise<FeatureFlags> {
  const values = await evaluate(allFlags);
  return combine(allFlags, values) as FeatureFlags;
}

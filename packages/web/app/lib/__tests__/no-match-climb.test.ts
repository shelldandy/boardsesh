import { describe, it, expect } from 'vitest';
import { isNoMatchClimb } from '../no-match-climb';

describe('isNoMatchClimb', () => {
  it('returns false for null/undefined/empty description', () => {
    expect(isNoMatchClimb(null)).toBe(false);
    expect(isNoMatchClimb(undefined)).toBe(false);
    expect(isNoMatchClimb('')).toBe(false);
  });

  it('returns true when description starts with "No matching."', () => {
    expect(isNoMatchClimb('No matching.')).toBe(true);
    expect(isNoMatchClimb('No matching. Some extra notes')).toBe(true);
  });

  it('returns false for descriptions that do not start with the prefix', () => {
    expect(isNoMatchClimb('A fun climb')).toBe(false);
    expect(isNoMatchClimb('no matching.')).toBe(false); // case-sensitive
    expect(isNoMatchClimb('This has No matching. in the middle')).toBe(false);
  });
});

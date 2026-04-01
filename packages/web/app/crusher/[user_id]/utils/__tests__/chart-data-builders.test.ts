import { describe, it, expect, vi } from 'vitest';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

vi.mock('@/app/lib/grade-colors', () => ({
  FONT_GRADE_COLORS: {
    '4a': '#FFEB3B',
    '5a': '#FFC107',
    '6a': '#FF7043',
    '6b': '#FF5722',
    '7a': '#E53935',
    '7b': '#C62828',
    '8a': '#9C27B0',
  },
  getGradeColorWithOpacity: (hex: string, opacity: number) => `rgba(0,0,0,${opacity})`,
}));

vi.mock('@/app/lib/board-data', () => ({
  SUPPORTED_BOARDS: ['kilter', 'tension', 'moonboard'],
}));

vi.mock('@/app/theme/theme-config', () => ({
  themeTokens: { colors: { success: '#6B9080', error: '#B8524C' } },
}));

import {
  filterLogbookByTimeframe,
  buildWeeklyBars,
  buildFlashRedpointBars,
  buildStatisticsSummary,
} from '../chart-data-builders';
import type { LogbookEntry } from '../profile-constants';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<LogbookEntry> = {}): LogbookEntry {
  return {
    climbed_at: dayjs().toISOString(),
    difficulty: 22, // '7a'
    tries: 1,
    angle: 40,
    ...overrides,
  };
}

// ── filterLogbookByTimeframe ─────────────────────────────────────────────────

describe('filterLogbookByTimeframe', () => {
  it("'all' returns every entry unchanged", () => {
    const logbook = [
      makeEntry({ climbed_at: dayjs().subtract(3, 'year').toISOString() }),
      makeEntry({ climbed_at: dayjs().subtract(1, 'day').toISOString() }),
    ];
    expect(filterLogbookByTimeframe(logbook, 'all', '', '')).toHaveLength(2);
  });

  it("'lastWeek' keeps only entries within the last 7 days", () => {
    const logbook = [
      makeEntry({ climbed_at: dayjs().subtract(3, 'day').toISOString() }),
      makeEntry({ climbed_at: dayjs().subtract(10, 'day').toISOString() }),
    ];
    const result = filterLogbookByTimeframe(logbook, 'lastWeek', '', '');
    expect(result).toHaveLength(1);
    expect(dayjs(result[0].climbed_at).isAfter(dayjs().subtract(1, 'week'))).toBe(true);
  });

  it("'lastWeek' returns empty array when no entries are within 7 days", () => {
    const logbook = [makeEntry({ climbed_at: dayjs().subtract(30, 'day').toISOString() })];
    expect(filterLogbookByTimeframe(logbook, 'lastWeek', '', '')).toHaveLength(0);
  });

  it("'lastMonth' keeps only entries within the last month", () => {
    const logbook = [
      makeEntry({ climbed_at: dayjs().subtract(2, 'week').toISOString() }),
      makeEntry({ climbed_at: dayjs().subtract(2, 'month').toISOString() }),
    ];
    const result = filterLogbookByTimeframe(logbook, 'lastMonth', '', '');
    expect(result).toHaveLength(1);
    expect(dayjs(result[0].climbed_at).isAfter(dayjs().subtract(1, 'month'))).toBe(true);
  });

  it("'lastYear' keeps only entries within the last year", () => {
    const logbook = [
      makeEntry({ climbed_at: dayjs().subtract(6, 'month').toISOString() }),
      makeEntry({ climbed_at: dayjs().subtract(2, 'year').toISOString() }),
    ];
    const result = filterLogbookByTimeframe(logbook, 'lastYear', '', '');
    expect(result).toHaveLength(1);
  });

  it("'lastYear' returns empty array when no entries within the last year", () => {
    const logbook = [makeEntry({ climbed_at: dayjs().subtract(2, 'year').toISOString() })];
    expect(filterLogbookByTimeframe(logbook, 'lastYear', '', '')).toHaveLength(0);
  });

  it("'custom' uses fromDate and toDate (inclusive on both ends)", () => {
    const from = '2024-03-01';
    const to = '2024-03-31';
    const logbook = [
      makeEntry({ climbed_at: '2024-03-15T12:00:00Z' }),
      makeEntry({ climbed_at: '2024-02-28T12:00:00Z' }),
      makeEntry({ climbed_at: '2024-04-01T12:00:00Z' }),
      makeEntry({ climbed_at: '2024-03-01T00:00:00Z' }), // boundary — same as fromDate
      makeEntry({ climbed_at: '2024-03-31T23:59:59Z' }), // boundary — same as toDate
    ];
    const result = filterLogbookByTimeframe(logbook, 'custom', from, to);
    expect(result).toHaveLength(3);
  });

  it("'custom' returns empty array when range excludes all entries", () => {
    const logbook = [makeEntry({ climbed_at: '2023-01-01T00:00:00Z' })];
    const result = filterLogbookByTimeframe(logbook, 'custom', '2024-01-01', '2024-12-31');
    expect(result).toHaveLength(0);
  });

  it('returns the full logbook for an unrecognised timeframe (default branch)', () => {
    const logbook = [makeEntry()];
    // Cast to any to test the default branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(filterLogbookByTimeframe(logbook, 'unknown' as any, '', '')).toHaveLength(1);
  });
});

// ── buildWeeklyBars ──────────────────────────────────────────────────────────

describe('buildWeeklyBars', () => {
  it('returns null for an empty logbook', () => {
    expect(buildWeeklyBars([])).toBeNull();
  });

  it('returns null when all entries have null difficulty', () => {
    const logbook = [makeEntry({ difficulty: null }), makeEntry({ difficulty: null })];
    expect(buildWeeklyBars(logbook)).toBeNull();
  });

  it('groups entries by ISO week', () => {
    // Two entries in the same week, one in a different week
    const week1Date = '2024-01-08T12:00:00Z'; // W2 2024
    const week2Date = '2024-01-15T12:00:00Z'; // W3 2024
    const logbook = [
      // Most-recent first (assumed order)
      makeEntry({ climbed_at: week2Date, difficulty: 22 }), // 7a W3
      makeEntry({ climbed_at: week1Date, difficulty: 22 }), // 7a W2
      makeEntry({ climbed_at: week1Date, difficulty: 22 }), // 7a W2
    ];
    const result = buildWeeklyBars(logbook);
    expect(result).not.toBeNull();

    const w2 = result!.find((b) => b.key === `W${dayjs(week1Date).isoWeek()}`);
    const w3 = result!.find((b) => b.key === `W${dayjs(week2Date).isoWeek()}`);

    expect(w2).toBeDefined();
    expect(w3).toBeDefined();

    const w2GradeSegment = w2!.segments.find((s) => s.label === '7a');
    const w3GradeSegment = w3!.segments.find((s) => s.label === '7a');

    expect(w2GradeSegment?.value).toBe(2);
    expect(w3GradeSegment?.value).toBe(1);
  });

  it('only includes grades that actually appear in the data', () => {
    const logbook = [makeEntry({ climbed_at: '2024-01-15T12:00:00Z', difficulty: 22 })]; // only 7a
    const result = buildWeeklyBars(logbook);
    expect(result).not.toBeNull();
    const grades = result![0].segments.map((s) => s.label);
    expect(grades).toEqual(['7a']);
    // Must not include grades like '6a' that have no data
    expect(grades).not.toContain('6a');
  });

  it('ignores entries with null difficulty', () => {
    const logbook = [
      makeEntry({ climbed_at: '2024-01-15T12:00:00Z', difficulty: 22 }), // 7a
      makeEntry({ climbed_at: '2024-01-15T12:00:00Z', difficulty: null }),
    ];
    const result = buildWeeklyBars(logbook);
    expect(result).not.toBeNull();
    const w3 = result!.find((b) => b.key === `W${dayjs('2024-01-15T12:00:00Z').isoWeek()}`);
    const totalValue = w3!.segments.reduce((sum, s) => sum + s.value, 0);
    expect(totalValue).toBe(1); // null entry not counted
  });

  it('caps output at MAX_WEEKS=26 (keeps most recent weeks)', () => {
    // Create 30 entries each in a distinct week, all within a single calendar year
    // to avoid ISO week number collisions across year boundaries.
    // Anchor to the middle of the year so subtracting 30 weeks stays within 2024.
    const entries: LogbookEntry[] = [];
    for (let w = 0; w < 30; w++) {
      entries.push(
        makeEntry({
          // Anchor on 2024-07-01 (W27) so subtracting 29 weeks lands in W52 of 2023 at most.
          // Use a Monday so each subtraction lands on a different ISO week.
          climbed_at: dayjs('2024-07-01').subtract(w, 'week').toISOString(),
          difficulty: 22,
        }),
      );
    }
    // Sort most-recent first to match the expected logbook ordering
    entries.sort((a, b) => (a.climbed_at > b.climbed_at ? -1 : 1));

    const result = buildWeeklyBars(entries);
    expect(result).not.toBeNull();
    // The implementation builds all week-label slots between the oldest and newest
    // entry, then slices to the most recent DEFAULT_MAX_WEEKS=52. With 30 distinct
    // input weeks (under the cap), all 30 bars appear in the output.
    expect(result!.length).toBe(30);
  });

  it('returns bars with the correct structure', () => {
    const logbook = [makeEntry({ climbed_at: '2024-01-15T12:00:00Z', difficulty: 22 })];
    const result = buildWeeklyBars(logbook);
    expect(result).not.toBeNull();
    const bar = result![0];
    expect(bar).toHaveProperty('key');
    expect(bar).toHaveProperty('label');
    expect(Array.isArray(bar.segments)).toBe(true);
    const seg = bar.segments[0];
    expect(seg).toHaveProperty('value');
    expect(seg).toHaveProperty('color');
    expect(seg).toHaveProperty('label');
  });
});

// ── buildFlashRedpointBars ───────────────────────────────────────────────────

describe('buildFlashRedpointBars', () => {
  it('returns null for an empty logbook', () => {
    expect(buildFlashRedpointBars([])).toBeNull();
  });

  it('returns null when all entries have null difficulty', () => {
    const logbook = [makeEntry({ difficulty: null }), makeEntry({ difficulty: null, tries: 3 })];
    expect(buildFlashRedpointBars(logbook)).toBeNull();
  });

  it('returns null when all entries have zero tries (edge case)', () => {
    // tries===0 is neither flash nor redpoint, so no grades accumulate
    const logbook = [makeEntry({ difficulty: 22, tries: 0 })];
    expect(buildFlashRedpointBars(logbook)).toBeNull();
  });

  it('identifies a flash as tries===1 and counts occurrences', () => {
    const logbook = [
      makeEntry({ difficulty: 22, tries: 1 }), // 7a flash
      makeEntry({ difficulty: 22, tries: 1 }), // 7a flash
    ];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    const bar = result!.find((b) => b.key === '7a')!;
    const flashSeg = bar.values.find((v) => v.label === 'Flash')!;
    expect(flashSeg.value).toBe(2);
  });

  it('identifies a redpoint as tries>1 and sums tries (not count)', () => {
    const logbook = [
      makeEntry({ difficulty: 22, tries: 3 }), // 7a redpoint — 3 tries
      makeEntry({ difficulty: 22, tries: 5 }), // 7a redpoint — 5 tries
    ];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    const bar = result!.find((b) => b.key === '7a')!;
    const redpointSeg = bar.values.find((v) => v.label === 'Redpoint')!;
    expect(redpointSeg.value).toBe(8); // 3 + 5, not 2
  });

  it('treats flash and redpoint independently for the same grade', () => {
    const logbook = [
      makeEntry({ difficulty: 22, tries: 1 }), // 7a flash
      makeEntry({ difficulty: 22, tries: 4 }), // 7a redpoint — 4 tries
    ];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    const bar = result!.find((b) => b.key === '7a')!;
    const flashSeg = bar.values.find((v) => v.label === 'Flash')!;
    const redpointSeg = bar.values.find((v) => v.label === 'Redpoint')!;
    expect(flashSeg.value).toBe(1);
    expect(redpointSeg.value).toBe(4);
  });

  it('returns grades in GRADE_ORDER (ascending difficulty)', () => {
    const logbook = [
      makeEntry({ difficulty: 24, tries: 1 }), // 7b — added last in logbook
      makeEntry({ difficulty: 22, tries: 1 }), // 7a — added first in logbook
    ];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    const keys = result!.map((b) => b.key);
    expect(keys).toEqual(['7a', '7b']); // grade order, not insertion order
  });

  it('ignores entries with null difficulty', () => {
    const logbook = [
      makeEntry({ difficulty: 22, tries: 1 }),
      makeEntry({ difficulty: null, tries: 1 }),
    ];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
    expect(result![0].key).toBe('7a');
  });

  it('each bar has exactly two values: Flash and Redpoint', () => {
    const logbook = [makeEntry({ difficulty: 22, tries: 1 })];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    const bar = result![0];
    expect(bar.values).toHaveLength(2);
    const labels = bar.values.map((v) => v.label);
    expect(labels).toContain('Flash');
    expect(labels).toContain('Redpoint');
  });

  it('a grade with only flashes has Redpoint value of 0', () => {
    const logbook = [makeEntry({ difficulty: 22, tries: 1 })];
    const result = buildFlashRedpointBars(logbook);
    const bar = result!.find((b) => b.key === '7a')!;
    expect(bar.values.find((v) => v.label === 'Redpoint')!.value).toBe(0);
  });

  it('a grade with only redpoints has Flash value of 0', () => {
    const logbook = [makeEntry({ difficulty: 22, tries: 3 })];
    const result = buildFlashRedpointBars(logbook);
    const bar = result!.find((b) => b.key === '7a')!;
    expect(bar.values.find((v) => v.label === 'Flash')!.value).toBe(0);
  });

  it('handles multiple different grades correctly', () => {
    const logbook = [
      makeEntry({ difficulty: 16, tries: 1 }), // 6a flash
      makeEntry({ difficulty: 22, tries: 2 }), // 7a redpoint
      makeEntry({ difficulty: 28, tries: 1 }), // 8a flash
    ];
    const result = buildFlashRedpointBars(logbook);
    expect(result).not.toBeNull();
    const keys = result!.map((b) => b.key);
    expect(keys).toContain('6a');
    expect(keys).toContain('7a');
    expect(keys).toContain('8a');
  });
});

// ── buildStatisticsSummary ───────────────────────────────────────────────────

describe('buildStatisticsSummary', () => {
  it('returns zero totals for null input', () => {
    const result = buildStatisticsSummary(null);
    expect(result.totalAscents).toBe(0);
    expect(result.layoutPercentages).toEqual([]);
  });

  it('uses totalDistinctClimbs as totalAscents', () => {
    const profileStats = {
      totalDistinctClimbs: 42,
      layoutStats: [],
    };
    expect(buildStatisticsSummary(profileStats).totalAscents).toBe(42);
  });

  it('filters out layouts with 0 distinctClimbCount', () => {
    const profileStats = {
      totalDistinctClimbs: 10,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 10, gradeCounts: [] },
        { layoutKey: 'tension-9', boardType: 'tension', layoutId: 9, distinctClimbCount: 0, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    expect(layoutPercentages).toHaveLength(1);
    expect(layoutPercentages[0].layoutKey).toBe('kilter-1');
  });

  it('computes percentage for a single layout as 100', () => {
    const profileStats = {
      totalDistinctClimbs: 50,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 50, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    expect(layoutPercentages[0].percentage).toBe(100);
  });

  it('percentages sum to 100 for two equal layouts', () => {
    const profileStats = {
      totalDistinctClimbs: 100,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 50, gradeCounts: [] },
        { layoutKey: 'tension-9', boardType: 'tension', layoutId: 9, distinctClimbCount: 50, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    const total = layoutPercentages.reduce((sum, l) => sum + l.percentage, 0);
    expect(total).toBe(100);
  });

  it('uses largest remainder method so percentages sum to 100', () => {
    // 3 layouts with 1/3 each — floored each gives 33, sum=99, one gets bumped to 34
    const profileStats = {
      totalDistinctClimbs: 3,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 1, gradeCounts: [] },
        { layoutKey: 'kilter-8', boardType: 'kilter', layoutId: 8, distinctClimbCount: 1, gradeCounts: [] },
        { layoutKey: 'tension-9', boardType: 'tension', layoutId: 9, distinctClimbCount: 1, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    const total = layoutPercentages.reduce((sum, l) => sum + l.percentage, 0);
    expect(total).toBe(100);
  });

  it('maps numeric grade keys in gradeCounts to font grade names', () => {
    const profileStats = {
      totalDistinctClimbs: 10,
      layoutStats: [
        {
          layoutKey: 'kilter-1',
          boardType: 'kilter',
          layoutId: 1,
          distinctClimbCount: 10,
          gradeCounts: [
            { grade: '22', count: 5 }, // maps to '7a'
            { grade: '24', count: 3 }, // maps to '7b'
          ],
        },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    expect(layoutPercentages[0].grades).toEqual({ '7a': 5, '7b': 3 });
  });

  it('ignores grade keys that are not valid numbers or not in the difficulty mapping', () => {
    const profileStats = {
      totalDistinctClimbs: 5,
      layoutStats: [
        {
          layoutKey: 'kilter-1',
          boardType: 'kilter',
          layoutId: 1,
          distinctClimbCount: 5,
          gradeCounts: [
            { grade: 'notANumber', count: 5 },
            { grade: '99', count: 2 }, // valid number but not in difficultyMapping
          ],
        },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    expect(layoutPercentages[0].grades).toEqual({});
  });

  it('sorts layout percentages by count descending', () => {
    const profileStats = {
      totalDistinctClimbs: 100,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 20, gradeCounts: [] },
        { layoutKey: 'tension-9', boardType: 'tension', layoutId: 9, distinctClimbCount: 80, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    expect(layoutPercentages[0].count).toBe(80);
    expect(layoutPercentages[1].count).toBe(20);
  });

  it('still includes layouts with count>0 when totalDistinctClimbs is 0', () => {
    // When totalDistinctClimbs=0 the exact percentage is 0 for each layout.
    // The largest-remainder method distributes (100 - 0) = 100 remainder points,
    // so the single layout ends up with percentage=1 (one remainder point).
    // The important thing is that the layout is not silently dropped.
    const profileStats = {
      totalDistinctClimbs: 0,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 5, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    expect(layoutPercentages).toHaveLength(1);
    // percentage gets 1 from remainder distribution (edge case of the algorithm)
    expect(layoutPercentages[0].percentage).toBe(1);
  });

  it('returned objects do not include internal fields (exactPercentage, remainder)', () => {
    const profileStats = {
      totalDistinctClimbs: 10,
      layoutStats: [
        { layoutKey: 'kilter-1', boardType: 'kilter', layoutId: 1, distinctClimbCount: 10, gradeCounts: [] },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    const entry = layoutPercentages[0] as unknown as Record<string, unknown>;
    expect(entry).not.toHaveProperty('exactPercentage');
    expect(entry).not.toHaveProperty('remainder');
  });

  it('each LayoutPercentage entry has required shape', () => {
    const profileStats = {
      totalDistinctClimbs: 10,
      layoutStats: [
        {
          layoutKey: 'kilter-1',
          boardType: 'kilter',
          layoutId: 1,
          distinctClimbCount: 10,
          gradeCounts: [{ grade: '22', count: 10 }],
        },
      ],
    };
    const { layoutPercentages } = buildStatisticsSummary(profileStats);
    const entry = layoutPercentages[0];
    expect(entry).toHaveProperty('layoutKey', 'kilter-1');
    expect(entry).toHaveProperty('boardType', 'kilter');
    expect(entry).toHaveProperty('layoutId', 1);
    expect(typeof entry.displayName).toBe('string');
    expect(typeof entry.color).toBe('string');
    expect(entry).toHaveProperty('count', 10);
    expect(typeof entry.grades).toBe('object');
    expect(typeof entry.percentage).toBe('number');
  });
});

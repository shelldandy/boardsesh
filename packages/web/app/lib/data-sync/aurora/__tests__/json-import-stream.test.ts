import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImportProgressEvent } from '../json-import';

// ---------------------------------------------------------------------------
// Helpers to build a mock ReadableStream from chunks
// ---------------------------------------------------------------------------

function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchResponse(
  body: ReadableStream<Uint8Array> | null,
  opts: { ok?: boolean; status?: number; jsonBody?: unknown } = {},
) {
  const { ok = true, status = 200, jsonBody } = opts;
  return {
    ok,
    status,
    body,
    json: jsonBody !== undefined ? () => Promise.resolve(jsonBody) : () => Promise.reject(new Error('not json')),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('streamImport', () => {
  let streamImport: typeof import('../json-import-stream').streamImport;

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Dynamic import to pick up fresh mocks each time
    const mod = await import('../json-import-stream');
    streamImport = mod.streamImport;
  });

  it('parses newline-delimited JSON events from stream', async () => {
    const events: ImportProgressEvent[] = [
      { type: 'progress', step: 'resolving', message: 'Resolving 5 climb names...' },
      { type: 'progress', step: 'dedup', message: 'Checking for duplicates...' },
      { type: 'progress', step: 'ascents', current: 10, total: 10 },
      {
        type: 'complete',
        results: {
          ascents: { imported: 10, skipped: 0, failed: 0 },
          attempts: { imported: 0, skipped: 0, failed: 0 },
          circuits: { imported: 0, skipped: 0, failed: 0 },
          unresolvedClimbs: [],
        },
      },
    ];

    const chunks = [events.map((e) => JSON.stringify(e)).join('\n') + '\n'];
    const stream = createMockReadableStream(chunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const received: ImportProgressEvent[] = [];
    await streamImport('kilter', {}, (e) => received.push(e));

    expect(received).toEqual(events);
  });

  it('handles events split across multiple chunks', async () => {
    const event1 = JSON.stringify({ type: 'progress', step: 'resolving', message: 'hi' });
    const event2 = JSON.stringify({ type: 'progress', step: 'dedup', message: 'dup' });

    // Split event1 across two chunks, event2 in a third
    const half = Math.floor(event1.length / 2);
    const chunks = [
      event1.slice(0, half),
      event1.slice(half) + '\n',
      event2 + '\n',
    ];

    const stream = createMockReadableStream(chunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const received: ImportProgressEvent[] = [];
    await streamImport('tension', {}, (e) => received.push(e));

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ type: 'progress', step: 'resolving', message: 'hi' });
    expect(received[1]).toEqual({ type: 'progress', step: 'dedup', message: 'dup' });
  });

  it('processes remaining buffer data after stream ends (no trailing newline)', async () => {
    const event = { type: 'complete', results: { ascents: { imported: 1, skipped: 0, failed: 0 }, attempts: { imported: 0, skipped: 0, failed: 0 }, circuits: { imported: 0, skipped: 0, failed: 0 }, unresolvedClimbs: [] } };
    // No trailing newline — data stays in buffer until stream ends
    const chunks = [JSON.stringify(event)];
    const stream = createMockReadableStream(chunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const received: ImportProgressEvent[] = [];
    await streamImport('kilter', {}, (e) => received.push(e));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });

  it('throws on non-ok response with JSON error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse(null, { ok: false, status: 400, jsonBody: { error: 'Bad request data' } }),
    );

    await expect(streamImport('kilter', {}, vi.fn())).rejects.toThrow('Bad request data');
  });

  it('throws generic message on non-ok response with non-JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
      body: null,
    } as unknown as Response);

    await expect(streamImport('kilter', {}, vi.fn())).rejects.toThrow('Import failed');
  });

  it('throws when response has no body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(null));

    await expect(streamImport('kilter', {}, vi.fn())).rejects.toThrow('No response body');
  });

  it('skips malformed JSON lines without throwing', async () => {
    const validEvent = { type: 'progress', step: 'resolving', message: 'ok' };
    const chunks = [
      'not valid json\n' + JSON.stringify(validEvent) + '\n',
    ];
    const stream = createMockReadableStream(chunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const received: ImportProgressEvent[] = [];
    await streamImport('kilter', {}, (e) => received.push(e));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(validEvent);
    expect(warnSpy).toHaveBeenCalledWith('Failed to parse import stream line:', 'not valid json');
  });

  it('skips malformed JSON in remaining buffer without throwing', async () => {
    // Buffer with invalid JSON and no trailing newline
    const chunks = ['not json at all'];
    const stream = createMockReadableStream(chunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const received: ImportProgressEvent[] = [];
    await streamImport('kilter', {}, (e) => received.push(e));

    expect(received).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith('Failed to parse import stream buffer:', 'not json at all');
  });

  it('sends correct fetch request with board type and data', async () => {
    const stream = createMockReadableStream([]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const testData = { ascents: [], attempts: [], circuits: [] };
    await streamImport('tension', testData, vi.fn());

    expect(fetchSpy).toHaveBeenCalledWith('/api/internal/aurora-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardType: 'tension', data: testData }),
    });
  });

  it('skips empty lines between events', async () => {
    const event = { type: 'progress', step: 'resolving', message: 'test' };
    const chunks = ['\n\n' + JSON.stringify(event) + '\n\n'];
    const stream = createMockReadableStream(chunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(stream));

    const received: ImportProgressEvent[] = [];
    await streamImport('kilter', {}, (e) => received.push(e));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });
});

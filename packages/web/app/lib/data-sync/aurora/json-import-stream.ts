import type { ImportProgressEvent } from './json-import';

/**
 * Streams an Aurora JSON import request, calling onEvent for each
 * newline-delimited JSON progress event from the server.
 */
export async function streamImport(
  boardType: 'kilter' | 'tension',
  data: unknown,
  onEvent: (event: ImportProgressEvent) => void,
): Promise<void> {
  const response = await fetch('/api/internal/aurora-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardType, data }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(errorBody.error || 'Import failed');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (line.trim()) {
        const event: ImportProgressEvent = JSON.parse(line);
        onEvent(event);
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim()) {
    const event: ImportProgressEvent = JSON.parse(buffer);
    onEvent(event);
  }
}

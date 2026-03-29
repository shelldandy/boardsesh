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
    let message = 'Import failed';
    try {
      const errorBody = await response.json();
      message = errorBody.error || message;
    } catch {
      // Response body isn't valid JSON (e.g. HTML error page)
    }
    throw new Error(message);
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
        try {
          const event: ImportProgressEvent = JSON.parse(line);
          onEvent(event);
        } catch {
          console.warn('Failed to parse import stream line:', line);
        }
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim()) {
    try {
      const event: ImportProgressEvent = JSON.parse(buffer);
      onEvent(event);
    } catch {
      console.warn('Failed to parse import stream buffer:', buffer);
    }
  }
}

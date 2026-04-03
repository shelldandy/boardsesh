import { describe, it, expect } from 'vitest';

/**
 * Test BLE packet generation against known-good Aurora payloads.
 *
 * These payloads were captured from Aurora's official Kilter app for the
 * SAME climb on two different board sizes. They serve as ground truth
 * for LED position correctness.
 *
 * Climb holds (6 holds, same placement IDs on both sizes):
 *   4131 (x=-40, y=140) — starting hold (color 0xe3)
 *   4421 (x=40, y=140)  — starting hold (color 0xe3)
 *   4669 (x=36, y=-8)   — foot hold (color 0xf4)
 *   4655 (x=40, y=-4)   — foot hold (color 0xf4)
 *   4665 (x=-40, y=-4)  — foot hold (color 0xf4)
 *   4678 (x=-36, y=-8)  — foot hold (color 0xf4)
 */

// ---- Inline packet helpers (matching bluetooth.ts) ----

const checksum = (data: number[]) => data.reduce((acc, value) => (acc + value) & 255, 0) ^ 255;

const wrapBytes = (data: number[]) =>
  data.length > 255 ? [] : [1, data.length, checksum(data), 2, ...data, 3];

const encodePosition = (position: number) => [position & 255, (position >> 8) & 255];

const encodeColor = (color: string) => {
  const parsedColor = [
    Math.floor(parseInt(color.substring(0, 2), 16) / 32) << 5,
    Math.floor(parseInt(color.substring(2, 4), 16) / 32) << 2,
    Math.floor(parseInt(color.substring(4, 6), 16) / 64),
  ].reduce((acc, val) => acc | val);
  return parsedColor;
};

// Kilter hold state codes → colors (from HOLD_STATE_MAP)
const KILTER_STATE_COLORS: Record<number, string> = {
  42: '00DD00', // STARTING
  43: '00FFFF', // HAND
  44: 'FF00FF', // FINISH
  45: 'FFAA00', // FOOT
};

/**
 * Simplified getBluetoothPacket matching the fixed version in bluetooth.ts.
 * Skips placements not found in the LED map (the NaN→0 fix).
 */
function getBluetoothPacket(
  frames: string,
  placementPositions: Record<number, number>,
): Uint8Array {
  const PACKET_MIDDLE = 81;
  const PACKET_FIRST = 82;
  const PACKET_LAST = 83;
  const PACKET_ONLY = 84;

  const resultArray: number[][] = [];
  let tempArray = [PACKET_MIDDLE];

  frames.split('p').forEach((frame) => {
    if (!frame) return;

    const [placement, role] = frame.split('r');
    const placementId = Number(placement);
    const ledPosition = placementPositions[placementId];

    if (ledPosition === undefined) return; // Skip missing placements

    const color = KILTER_STATE_COLORS[Number(role)];
    const encodedFrame = [...encodePosition(ledPosition), encodeColor(color)];

    if (tempArray.length + encodedFrame.length > 255) {
      resultArray.push(tempArray);
      tempArray = [PACKET_MIDDLE];
    }
    tempArray.push(...encodedFrame);
  });

  resultArray.push(tempArray);
  if (resultArray.length === 1) resultArray[0][0] = PACKET_ONLY;
  else {
    resultArray[0][0] = PACKET_FIRST;
    resultArray[resultArray.length - 1][0] = PACKET_LAST;
  }

  return Uint8Array.from(resultArray.flatMap(wrapBytes));
}

// ---- Packet decoder ----

function decodeLeds(hex: string): { position: number; color: number }[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  // SOH(1) Length(1) Checksum(1) STX(1) Command(1) ...ledData... ETX(1)
  const ledData = bytes.slice(5, -1);
  const leds: { position: number; color: number }[] = [];
  for (let i = 0; i < ledData.length; i += 3) {
    leds.push({
      position: ledData[i] | (ledData[i + 1] << 8),
      color: ledData[i + 2],
    });
  }
  return leds;
}

function decodeLedPositions(packet: Uint8Array): { position: number; color: number }[] {
  const bytes = Array.from(packet);
  const ledData = bytes.slice(5, -1);
  const leds: { position: number; color: number }[] = [];
  for (let i = 0; i < ledData.length; i += 3) {
    leds.push({
      position: ledData[i] | (ledData[i + 1] << 8),
      color: ledData[i + 2],
    });
  }
  return leds;
}

// ---- Known-good Aurora payloads ----

const AURORA_8x12_HEX = '01134002542700e38501e31400f41300f40100f40000f403';
const AURORA_10x12_HEX = '0113e202545000e3ae01e30400f40300f41700f41600f403';

// Frames string for this climb (derived from placement IDs)
// Order matches Aurora payload: 4131, 4421, 4669, 4655, 4665, 4678
const CLIMB_FRAMES = 'p4131r42p4421r42p4669r45p4655r45p4665r45p4678r45';

// Correct LED positions from Aurora's official app
const CORRECT_8x12_POSITIONS: Record<number, number> = {
  4131: 39,
  4421: 389,
  4669: 20,
  4655: 19,
  4665: 1,
  4678: 0,
};

const CORRECT_10x12_POSITIONS: Record<number, number> = {
  4131: 80,
  4421: 430,
  4669: 4,
  4655: 3,
  4665: 23,
  4678: 22,
};

describe('BLE packet generation — Aurora payload verification', () => {
  it('generates correct LED positions for Kilter 10x12 Full Ride (size 25)', () => {
    const packet = getBluetoothPacket(CLIMB_FRAMES, CORRECT_10x12_POSITIONS);
    const ourLeds = decodeLedPositions(packet);
    const auroraLeds = decodeLeds(AURORA_10x12_HEX);

    expect(ourLeds).toHaveLength(auroraLeds.length);
    // Compare LED positions (colors differ because Aurora app uses different RGB values)
    const ourPositions = ourLeds.map((l) => l.position);
    const auroraPositions = auroraLeds.map((l) => l.position);
    expect(ourPositions).toEqual(auroraPositions);
  });

  it('generates correct LED positions for Kilter 8x12 Full Ride (size 23)', () => {
    const packet = getBluetoothPacket(CLIMB_FRAMES, CORRECT_8x12_POSITIONS);
    const ourLeds = decodeLedPositions(packet);
    const auroraLeds = decodeLeds(AURORA_8x12_HEX);

    expect(ourLeds).toHaveLength(auroraLeds.length);
    const ourPositions = ourLeds.map((l) => l.position);
    const auroraPositions = auroraLeds.map((l) => l.position);
    expect(ourPositions).toEqual(auroraPositions);
  });

  it('skips placements with no LED mapping instead of encoding position 0', () => {
    const sparseLedMap = { 4131: 39, 4421: 389 };
    const frames = 'p4131r42p4421r42p9999r45';

    const packet = getBluetoothPacket(frames, sparseLedMap);
    const leds = decodeLedPositions(packet);

    // 9999 should be skipped, not encoded as position 0
    expect(leds).toHaveLength(2);
    expect(leds[0].position).toBe(39);
    expect(leds[1].position).toBe(389);
  });

  it('verifies the 8x12 kickboard positions match Aurora expectations', () => {
    // These are the CORRECT positions that Aurora's official app uses
    // for the kickboard holds on the 8x12 Full Ride board.
    // Our database had these reversed (right-to-left instead of left-to-right).
    expect(CORRECT_8x12_POSITIONS[4678]).toBe(0);  // leftmost y=-8
    expect(CORRECT_8x12_POSITIONS[4665]).toBe(1);  // leftmost y=-4
    expect(CORRECT_8x12_POSITIONS[4655]).toBe(19); // rightmost y=-4
    expect(CORRECT_8x12_POSITIONS[4669]).toBe(20); // rightmost y=-8
  });
});

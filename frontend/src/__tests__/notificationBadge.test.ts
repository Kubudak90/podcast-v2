/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const badgePath = resolve(__dirname, '../../public/badge-72.png');
const pushSourcePath = resolve(__dirname, '../../../backend/src/lib/push.ts');

function decodePng(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * (stride + 1), (y + 1) * (stride + 1));
    expect(row[0]).toBe(0);
    row.copy(pixels, y * stride, 1);
  }
  return { width, height, bitDepth, colorType, pixels };
}

function pixel(pixels: Buffer, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

describe('notification badge', () => {
  const decoded = decodePng(readFileSync(badgePath));

  it('is a 72px transparent PNG', () => {
    expect(decoded.width).toBe(72);
    expect(decoded.height).toBe(72);
    expect(decoded.bitDepth).toBe(8);
    expect(decoded.colorType).toBe(6);
  });

  it('is a white microphone on a clear background', () => {
    const { pixels, width, height } = decoded;
    let opaque = 0;
    let clear = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = pixel(pixels, width, x, y);
        if (p.a === 0) {
          clear += 1;
          continue;
        }
        expect(p.r).toBe(255);
        expect(p.g).toBe(255);
        expect(p.b).toBe(255);
        if (p.a > 200) opaque += 1;
      }
    }
    expect(clear).toBeGreaterThan(1000);
    expect(opaque).toBeGreaterThan(200);

    for (const [x, y] of [
      [0, 0],
      [71, 0],
      [0, 71],
      [71, 71],
    ] as const) {
      expect(pixel(pixels, width, x, y).a).toBe(0);
    }

    expect(pixel(pixels, width, 35, 15).a).toBeGreaterThan(200);
    expect(pixel(pixels, width, 2, 15).a).toBe(0);
    expect(pixel(pixels, width, 35, 66).a).toBeGreaterThan(200);
  });

  it('matches the badge path the live notification sends', () => {
    const source = readFileSync(pushSourcePath, 'utf8');
    expect(source).toContain("badge: '/badge-72.png'");
  });
});

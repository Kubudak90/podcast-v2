/// <reference types="node" />
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readPng(file: string): { width: number; height: number; rgba: Buffer } {
  const buf = readFileSync(resolve(__dirname, '../../public', file));
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = y * width * 4;
    for (let i = 0; i < width * 4; i++) {
      const left = i >= 4 ? rgba[row + i - 4] : 0;
      const up = y > 0 ? rgba[row - width * 4 + i] : 0;
      const ul = y > 0 && i >= 4 ? rgba[row - width * 4 + i - 4] : 0;
      const value = raw[src++];
      if (filter === 0) rgba[row + i] = value;
      else if (filter === 1) rgba[row + i] = (value + left) & 255;
      else if (filter === 2) rgba[row + i] = (value + up) & 255;
      else if (filter === 3) rgba[row + i] = (value + Math.floor((left + up) / 2)) & 255;
      else rgba[row + i] = (value + paeth(left, up, ul)) & 255;
    }
  }
  return { width, height, rgba };
}

function pixel(image: { width: number; rgba: Buffer }, x: number, y: number) {
  const i = (y * image.width + x) * 4;
  return [image.rgba[i], image.rgba[i + 1], image.rgba[i + 2], image.rgba[i + 3]];
}

describe('PWA icons', () => {
  it('provides square any-purpose icons with a transparent corner and a white mic', () => {
    for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512]] as const) {
      const image = readPng(file);
      expect(image.width).toBe(size);
      expect(image.height).toBe(size);
      expect(pixel(image, 0, 0)[3]).toBe(0);
      const mid = pixel(image, Math.floor(size / 2), Math.floor(size * 0.39));
      expect(mid[0]).toBeGreaterThan(240);
      expect(mid[3]).toBe(255);
    }
  });

  it('fills maskable icons to the edge and keeps the mic inside', () => {
    for (const [file, size] of [['icon-maskable-192.png', 192], ['icon-maskable-512.png', 512]] as const) {
      const image = readPng(file);
      expect(image.width).toBe(size);
      expect(image.height).toBe(size);
      const corner = pixel(image, 0, 0);
      expect(corner[0]).toBe(99);
      expect(corner[1]).toBe(102);
      expect(corner[2]).toBe(241);
      expect(corner[3]).toBe(255);
      const mid = pixel(image, Math.floor(size / 2), Math.floor(size / 2));
      expect(mid[0]).toBeGreaterThan(240);
      expect(mid[3]).toBe(255);
    }
  });
});

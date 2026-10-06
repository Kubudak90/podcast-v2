import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8');
const css = readFileSync(resolve(frontendRoot, 'src/index.css'), 'utf8');

function blockAfter(source: string, start: number): string {
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return '';
}

describe('page zoom', () => {
  it('leaves pinch zoom available and keeps the safe-area viewport', () => {
    const viewport = html.match(/name="viewport" content="([^"]+)"/)?.[1] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).not.toMatch(/user-scalable/i);
    expect(viewport).not.toMatch(/maximum-scale/i);
  });
});

describe('text fields on touch screens', () => {
  it('uses 16px type so focusing a field does not zoom the page', () => {
    const start = css.search(/@media\s*\(\s*hover:\s*none\s*\)\s*and\s*\(\s*pointer:\s*coarse\s*\)/);
    const block = blockAfter(css, start);
    expect(block).toMatch(/font-size:\s*16px\s*!important/);
    expect(block).toContain('textarea');
    expect(block).toContain('select');
    expect(block).toContain('input:not([type="checkbox"])');
  });
});

describe('reduced motion', () => {
  it('stops decorative animation when the user prefers less motion', () => {
    const start = css.search(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
    const block = blockAfter(css, start);
    expect(block).toContain('animation-duration: 0.01ms');
    expect(block).toContain('animation-iteration-count: 1');
    expect(block).toContain('transition-duration: 0.01ms');
    for (const cue of [
      '.animate-speaking-ring',
      '.animate-speaking-pulse',
      '.audio-wave-bar',
      '.animate-slide-in',
      '.animate-spin',
      '.animate-pulse',
    ]) {
      expect(block).toContain(cue);
    }
    expect(block).toMatch(/animation:\s*none\s*!important/);
  });
});

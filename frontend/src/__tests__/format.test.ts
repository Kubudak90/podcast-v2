import { describe, expect, it } from 'vitest';
import { formatCount } from '../lib/format';

describe('formatCount', () => {
  it('keeps small counts exact', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(12)).toBe('12');
    expect(formatCount(9999)).toBe('9999');
  });

  it('compacts large counts', () => {
    expect(formatCount(10_000)).toBe('10K');
    expect(formatCount(12_500)).toBe('12.5K');
    expect(formatCount(2_000_000)).toBe('2M');
  });

  it('treats invalid numbers as zero', () => {
    expect(formatCount(Number.NaN)).toBe('0');
    expect(formatCount(-3)).toBe('0');
  });
});

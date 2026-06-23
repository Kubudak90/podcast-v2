import { describe, it, expect } from 'vitest';
import { reportSchema, blockSchema } from '../lib/validation.js';

describe('reportSchema', () => {
  it('accepts a valid report', () => {
    expect(reportSchema.safeParse({ targetType: 'recording', targetId: 'r1', reason: 'spam' }).success).toBe(true);
  });
  it('rejects an unknown targetType/reason', () => {
    expect(reportSchema.safeParse({ targetType: 'foo', targetId: 'r1', reason: 'spam' }).success).toBe(false);
    expect(reportSchema.safeParse({ targetType: 'recording', targetId: 'r1', reason: 'nope' }).success).toBe(false);
  });
});
describe('blockSchema', () => {
  it('requires blockedId', () => {
    expect(blockSchema.safeParse({ blockedId: 'u1' }).success).toBe(true);
    expect(blockSchema.safeParse({}).success).toBe(false);
  });
});

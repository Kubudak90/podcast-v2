/** Compact display for follower counts. Values under 10_000 stay exact. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  const value = Math.floor(n);
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 10_000) return `${trim(value / 1_000)}K`;
  return String(value);
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

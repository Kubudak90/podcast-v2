import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AudioLevelDot, AudioLevelMeter } from '../components/UI/AudioLevelMeter';

function bars(container: HTMLElement): HTMLElement[] {
  const root = container.firstElementChild as HTMLElement;
  return [...root.children] as HTMLElement[];
}

function litCount(container: HTMLElement): number {
  return bars(container).filter((bar) => /bg-(green|yellow|red)-500/.test(bar.className)).length;
}

describe('AudioLevelMeter', () => {
  it('is decorative so a live level is not announced', () => {
    const { container } = render(<AudioLevelMeter level={0.6} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.getAttribute('role')).toBeNull();
  });

  it('lights bars in proportion to the level', () => {
    const silent = render(<AudioLevelMeter level={0} barCount={10} />);
    expect(litCount(silent.container)).toBe(0);

    const half = render(<AudioLevelMeter level={0.5} barCount={10} />);
    expect(litCount(half.container)).toBe(5);

    const full = render(<AudioLevelMeter level={1} barCount={10} />);
    expect(litCount(full.container)).toBe(10);
  });

  it('does not light extra bars when the level is out of range', () => {
    const loud = render(<AudioLevelMeter level={4} barCount={5} />);
    expect(bars(loud.container)).toHaveLength(5);
    expect(litCount(loud.container)).toBe(5);

    const broken = render(<AudioLevelMeter level={Number.NaN} barCount={5} />);
    expect(litCount(broken.container)).toBe(0);

    const negative = render(<AudioLevelMeter level={-1} barCount={5} />);
    expect(litCount(negative.container)).toBe(0);
  });

  it('stacks vertically and skips motion when the user asks for less', () => {
    const { container } = render(
      <AudioLevelMeter level={0.2} orientation="vertical" barCount={4} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex-col-reverse');
    for (const bar of bars(container)) {
      expect(bar.className).toContain('motion-reduce:transition-none');
    }
  });
});

describe('AudioLevelDot', () => {
  it('is decorative and stays inside the silence-to-peak scale', () => {
    const { container } = render(<AudioLevelDot level={2} />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot.className).toContain('bg-red-500');
    expect(dot.style.transform).toBe('scale(1.3)');
    expect(dot.className).toContain('motion-reduce:transition-none');
  });

  it('shows silence for a non-finite level', () => {
    const { container } = render(<AudioLevelDot level={Number.NaN} />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.className).toContain('bg-pod-active');
    expect(dot.style.opacity).toBe('0.5');
  });
});

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VolumeSlider } from '../components/UI/VolumeSlider';

function Controlled({ initial = 0.4 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <VolumeSlider value={value} onChange={setValue} />;
}

function rect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {
      return {};
    },
  };
}

describe('VolumeSlider', () => {
  it('names the mute button and the slider', () => {
    render(<VolumeSlider value={0.4} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Sesi kapat' })).toBeEnabled();
    const slider = screen.getByRole('slider', { name: 'Ses' });
    expect(slider).toHaveAttribute('aria-valuenow', '40');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuetext', '40%');
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('mutes and restores the previous level', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={0.4} />);

    await user.click(screen.getByRole('button', { name: 'Sesi kapat' }));
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Sessiz');
    expect(screen.getByRole('button', { name: 'Sesi aç' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Sesi aç' }));
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('button', { name: 'Sesi kapat' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens a muted slider at 70 percent when there was no earlier level', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VolumeSlider value={0} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Sesi aç' }));
    expect(onChange).toHaveBeenCalledWith(0.7);
  });

  it('changes the level with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={0.4} />);
    const slider = screen.getByRole('slider', { name: 'Ses' });
    slider.focus();

    await user.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuenow', '45');

    await user.keyboard('{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '40');

    await user.keyboard('{ArrowUp}');
    expect(slider).toHaveAttribute('aria-valuenow', '45');

    await user.keyboard('{PageDown}');
    expect(slider).toHaveAttribute('aria-valuenow', '35');

    await user.keyboard('{Home}');
    expect(slider).toHaveAttribute('aria-valuetext', 'Sessiz');

    await user.keyboard('{End}');
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('keeps the level that was audible before Home', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={0.55} />);

    screen.getByRole('slider').focus();
    await user.keyboard('{Home}');
    await user.click(screen.getByRole('button', { name: 'Sesi aç' }));

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '55');
  });

  it('sets the level from a pointer on the track', () => {
    const onChange = vi.fn();
    render(<VolumeSlider value={0.2} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () => rect(100, 44);

    fireEvent.mouseDown(slider, { clientX: 50, clientY: 10 });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it('reads a vertical drag from the bottom', () => {
    const onChange = vi.fn();
    render(<VolumeSlider value={0.2} onChange={onChange} orientation="vertical" />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-orientation', 'vertical');
    slider.getBoundingClientRect = () => rect(44, 100);

    fireEvent.mouseDown(slider, { clientX: 10, clientY: 25 });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it('does not change while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VolumeSlider value={0.4} onChange={onChange} disabled />);

    expect(screen.getByRole('button', { name: 'Sesi kapat' })).toBeDisabled();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    expect(slider).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.mouseDown(slider, { clientX: 80, clientY: 10 });
    await user.click(screen.getByRole('button', { name: 'Sesi kapat' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('hides the mute button when the icon is off', () => {
    render(<VolumeSlider value={0.4} onChange={() => {}} showIcon={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Ses' })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListenerPrimaryAction } from '../components/ListenerPrimaryAction';

describe('ListenerPrimaryAction', () => {
  it('shows a mute control after the listener becomes a speaker', async () => {
    const onToggleMute = vi.fn();
    const user = userEvent.setup();

    render(<ListenerPrimaryAction isSpeaker isMuted onToggleMute={onToggleMute} />);

    const button = screen.getByRole('button', { name: 'Mikrofonu ac' });
    expect(button).toHaveTextContent('MIC OFF');
    await user.click(button);
    expect(onToggleMute).toHaveBeenCalledOnce();
  });

  it('labels an open mic as MIC ON', () => {
    render(<ListenerPrimaryAction isSpeaker isMuted={false} onToggleMute={() => {}} />);
    expect(screen.getByRole('button', { name: 'Mikrofonu kapat' })).toHaveTextContent('MIC ON');
  });

  it('keeps the request button for listeners', async () => {
    const onToggleMute = vi.fn();
    const user = userEvent.setup();

    render(<ListenerPrimaryAction isSpeaker={false} isMuted onToggleMute={onToggleMute} />);

    const button = screen.getByRole('button', { name: 'REQUEST' });
    await user.click(button);
    expect(onToggleMute).not.toHaveBeenCalled();
  });
});

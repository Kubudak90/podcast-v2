import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HostModerationBar, UnmuteRequestList } from '../components/HostModeration';
import type { RoomMember } from '../types';

const speaker: RoomMember = {
  id: 'p1',
  userId: 'user-2',
  username: 'ada',
  role: 'speaker',
  mutedByHost: false,
};

describe('HostModerationBar', () => {
  it('mutes a speaker and asks for confirmation before remove', () => {
    const onMute = vi.fn();
    const onUnmute = vi.fn();
    const onRemove = vi.fn();

    const { rerender } = render(
      <HostModerationBar
        member={speaker}
        busy={false}
        confirmRemove={false}
        onMute={onMute}
        onUnmute={onUnmute}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'MUTE' }));
    expect(onMute).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'REMOVE' }));
    expect(onRemove).toHaveBeenCalledOnce();

    rerender(
      <HostModerationBar
        member={{ ...speaker, mutedByHost: true }}
        busy={false}
        confirmRemove={true}
        onMute={onMute}
        onUnmute={onUnmute}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'UNMUTE' }));
    expect(onUnmute).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'CONFIRM REMOVE' })).toBeInTheDocument();
  });

  it('does not offer mute for a listener', () => {
    render(
      <HostModerationBar
        member={{ ...speaker, role: 'listener' }}
        busy={false}
        confirmRemove={false}
        onMute={vi.fn()}
        onUnmute={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'MUTE' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REMOVE' })).toBeInTheDocument();
  });
});

describe('UnmuteRequestList', () => {
  it('lets the host allow a request', () => {
    const onAllow = vi.fn();
    render(
      <UnmuteRequestList
        requests={[{ userId: 'user-2', username: 'ada' }]}
        busy={false}
        onAllow={onAllow}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'ALLOW' }));
    expect(onAllow).toHaveBeenCalledWith('user-2');
  });
});

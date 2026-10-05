import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModerationMenu } from '../components/ModerationMenu';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    reportContent: vi.fn(),
    blockUser: vi.fn(),
  },
}));

describe('ModerationMenu', () => {
  const mockApi = api as unknown as {
    reportContent: ReturnType<typeof vi.fn>;
    blockUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a chat message with an optional note', async () => {
    mockApi.reportContent.mockResolvedValue({ message: 'Report received' });
    render(<ModerationMenu username="ada" userId="user-ada" messageId="msg-1" />);

    fireEvent.click(screen.getByRole('button', { name: '@ada için işlemler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mesajı bildir' }));
    fireEvent.change(screen.getByLabelText('Not (isteğe bağlı)'), { target: { value: 'küfür' } });
    fireEvent.click(screen.getByRole('button', { name: 'Taciz' }));

    await waitFor(() => {
      expect(mockApi.reportContent).toHaveBeenCalledWith({
        targetType: 'message',
        targetId: 'msg-1',
        reason: 'harassment',
        note: 'küfür',
      });
    });
  });

  it('reports a participant', async () => {
    mockApi.reportContent.mockResolvedValue({ message: 'Report received' });
    render(<ModerationMenu username="ada" userId="user-ada" />);

    fireEvent.click(screen.getByRole('button', { name: '@ada için işlemler' }));
    expect(screen.queryByRole('button', { name: 'Mesajı bildir' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kullanıcıyı bildir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));

    await waitFor(() => {
      expect(mockApi.reportContent).toHaveBeenCalledWith({
        targetType: 'user',
        targetId: 'user-ada',
        reason: 'spam',
        note: undefined,
      });
    });
  });

  it('blocks the user and notifies the parent', async () => {
    mockApi.blockUser.mockResolvedValue({ message: 'Blocked' });
    const onBlocked = vi.fn();
    render(<ModerationMenu username="ada" userId="user-ada" onBlocked={onBlocked} />);

    fireEvent.click(screen.getByRole('button', { name: '@ada için işlemler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Engelle' }));

    await waitFor(() => {
      expect(mockApi.blockUser).toHaveBeenCalledWith('user-ada');
      expect(onBlocked).toHaveBeenCalledWith('user-ada');
    });
  });
});

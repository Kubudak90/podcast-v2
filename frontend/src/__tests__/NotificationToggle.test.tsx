import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationToggle } from '../components/NotificationToggle';
import * as pushModule from '../lib/push';

// Mock push module
vi.mock('../lib/push', () => ({
  isPushSupported: vi.fn(),
  getNotificationPermission: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  isPushSubscribed: vi.fn(),
}));

describe('NotificationToggle Component', () => {
  const mockPush = pushModule as unknown as {
    isPushSupported: ReturnType<typeof vi.fn>;
    getNotificationPermission: ReturnType<typeof vi.fn>;
    subscribeToPush: ReturnType<typeof vi.fn>;
    unsubscribeFromPush: ReturnType<typeof vi.fn>;
    isPushSubscribed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when push is not supported', () => {
    it('should show not supported message', async () => {
      mockPush.isPushSupported.mockReturnValue(false);
      mockPush.getNotificationPermission.mockReturnValue('unsupported');
      mockPush.isPushSubscribed.mockResolvedValue(false);

      render(<NotificationToggle />);

      await waitFor(() => {
        expect(screen.getByText('Push Notifications')).toBeInTheDocument();
        expect(screen.getByText('Not supported in this browser')).toBeInTheDocument();
      });
    });
  });

  describe('when permission is denied', () => {
    it('should show blocked message', async () => {
      mockPush.isPushSupported.mockReturnValue(true);
      mockPush.getNotificationPermission.mockReturnValue('denied');
      mockPush.isPushSubscribed.mockResolvedValue(false);

      render(<NotificationToggle />);

      await waitFor(() => {
        expect(screen.getByText('Blocked - Enable in browser settings')).toBeInTheDocument();
      });
    });
  });

  describe('when not subscribed', () => {
    beforeEach(() => {
      mockPush.isPushSupported.mockReturnValue(true);
      mockPush.getNotificationPermission.mockReturnValue('default');
      mockPush.isPushSubscribed.mockResolvedValue(false);
    });

    it('should show subscribe message', async () => {
      render(<NotificationToggle />);

      await waitFor(() => {
        expect(screen.getByText('Get notified when hosts go live')).toBeInTheDocument();
      });
    });

    it('should subscribe when toggle is clicked', async () => {
      mockPush.subscribeToPush.mockResolvedValue(true);

      render(<NotificationToggle />);

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockPush.subscribeToPush).toHaveBeenCalled();
      });
    });
  });

  describe('when subscribed', () => {
    beforeEach(() => {
      mockPush.isPushSupported.mockReturnValue(true);
      mockPush.getNotificationPermission.mockReturnValue('granted');
      mockPush.isPushSubscribed.mockResolvedValue(true);
    });

    it('should show subscribed message', async () => {
      render(<NotificationToggle />);

      await waitFor(() => {
        expect(screen.getByText('Receive alerts when hosts go live')).toBeInTheDocument();
      });
    });

    it('should unsubscribe when toggle is clicked', async () => {
      mockPush.unsubscribeFromPush.mockResolvedValue(true);

      render(<NotificationToggle />);

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockPush.unsubscribeFromPush).toHaveBeenCalled();
      });
    });

    it('should have active toggle styling', async () => {
      render(<NotificationToggle />);

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveClass('bg-pod-red');
      });
    });
  });

  describe('error handling', () => {
    it('should handle subscribe failure', async () => {
      mockPush.isPushSupported.mockReturnValue(true);
      mockPush.getNotificationPermission.mockReturnValue('default');
      mockPush.isPushSubscribed.mockResolvedValue(false);
      mockPush.subscribeToPush.mockResolvedValue(false);

      render(<NotificationToggle />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button'));
      });

      await waitFor(() => {
        // Should still show unsubscribed state
        expect(screen.getByText('Get notified when hosts go live')).toBeInTheDocument();
      });
    });
  });
});

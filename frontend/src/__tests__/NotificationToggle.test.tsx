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
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
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
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
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

    it('should name the switch and keep a 44px keyboard target', async () => {
      render(<NotificationToggle />);

      const toggle = await screen.findByRole('switch', { name: 'Push Notifications' });
      expect(toggle).toHaveAttribute('type', 'button');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveClass(
        'min-h-11',
        'min-w-11',
        'focus-visible:outline',
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-white'
      );
      const descriptionId = toggle.getAttribute('aria-describedby');
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(descriptionId!)).toHaveTextContent(
        'Get notified when hosts go live'
      );
    });

    it('should subscribe when toggle is clicked', async () => {
      mockPush.subscribeToPush.mockResolvedValue(true);

      render(<NotificationToggle />);

      const toggle = await screen.findByRole('switch', { name: 'Push Notifications' });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockPush.subscribeToPush).toHaveBeenCalled();
        expect(toggle).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('should subscribe when the label is clicked', async () => {
      mockPush.subscribeToPush.mockResolvedValue(true);

      render(<NotificationToggle />);

      await screen.findByRole('switch', { name: 'Push Notifications' });
      fireEvent.click(screen.getByText('Push Notifications'));

      await waitFor(() => {
        expect(mockPush.subscribeToPush).toHaveBeenCalled();
      });
    });

    it('should mark the switch busy while subscribing', async () => {
      let resolveSubscribe: (value: boolean) => void = () => {};
      mockPush.subscribeToPush.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveSubscribe = resolve;
          })
      );

      render(<NotificationToggle />);

      const toggle = await screen.findByRole('switch', { name: 'Push Notifications' });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-busy', 'true');
        expect(toggle).toBeDisabled();
      });

      resolveSubscribe(true);

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(toggle).not.toHaveAttribute('aria-busy');
        expect(toggle).not.toBeDisabled();
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

      const toggle = await screen.findByRole('switch', { name: 'Push Notifications' });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockPush.unsubscribeFromPush).toHaveBeenCalled();
        expect(toggle).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('should have active toggle styling', async () => {
      render(<NotificationToggle />);

      const toggle = await screen.findByRole('switch', { name: 'Push Notifications' });
      await waitFor(() => {
        expect(toggle.querySelector('span')).toHaveClass('bg-pod-red');
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

      const toggle = await screen.findByRole('switch', { name: 'Push Notifications' });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByText('Get notified when hosts go live')).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-checked', 'false');
      });
    });
  });
});

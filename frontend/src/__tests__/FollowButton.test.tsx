import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FollowButton } from '../components/FollowButton';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

describe('FollowButton Component', () => {
  const mockApi = api as unknown as {
    followUser: ReturnType<typeof vi.fn>;
    unfollowUser: ReturnType<typeof vi.fn>;
  };

  function mockHover(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockHover(false);
  });

  describe('rendering', () => {
    it('should render Follow button when not following', () => {
      render(<FollowButton userId="user-123" isFollowing={false} />);
      const button = screen.getByRole('button', { name: 'Follow' });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveClass('min-h-11', 'min-w-11');
      expect(button.className).toContain('focus-visible:outline-2');
      expect(button.className).toContain('focus-visible:outline-white');
    });

    it('should show Unfollow on touch when already following', () => {
      render(<FollowButton userId="user-123" isFollowing={true} />);
      const button = screen.getByRole('button', { name: 'Unfollow' });
      expect(button).toHaveTextContent('Unfollow');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveClass('min-h-11', 'bg-pod-red');
    });

    it('should keep Following until hover or focus when a pointer can hover', () => {
      mockHover(true);
      render(<FollowButton userId="user-123" isFollowing={true} />);
      const button = screen.getByRole('button', { name: 'Unfollow' });
      expect(button).toHaveTextContent('Following');
      expect(button).toHaveClass('bg-pod-active');

      fireEvent.mouseEnter(button);
      expect(button).toHaveTextContent('Unfollow');
      expect(button).toHaveClass('bg-pod-red');

      fireEvent.mouseLeave(button);
      expect(button).toHaveTextContent('Following');

      fireEvent.focus(button);
      expect(button).toHaveTextContent('Unfollow');

      fireEvent.blur(button);
      expect(button).toHaveTextContent('Following');
    });

    it('should render with sm size', () => {
      render(<FollowButton userId="user-123" isFollowing={false} size="sm" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3', 'py-1', 'text-sm', 'min-h-11', 'min-w-11');
    });

    it('should render with md size by default', () => {
      render(<FollowButton userId="user-123" isFollowing={false} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2', 'min-h-11');
    });

    it('should follow the isFollowing prop when it changes', () => {
      const { rerender } = render(<FollowButton userId="user-123" isFollowing={false} />);
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();

      rerender(<FollowButton userId="user-123" isFollowing={true} />);
      expect(screen.getByRole('button', { name: 'Unfollow' })).toHaveTextContent('Unfollow');
    });
  });

  describe('interactions', () => {
    it('should call followUser when clicking Follow', async () => {
      mockApi.followUser.mockResolvedValue({ message: 'Success' });
      const onFollowChange = vi.fn();

      render(
        <FollowButton
          userId="user-123"
          isFollowing={false}
          onFollowChange={onFollowChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

      await waitFor(() => {
        expect(mockApi.followUser).toHaveBeenCalledWith('user-123');
        expect(onFollowChange).toHaveBeenCalledWith(true);
      });
    });

    it('should call unfollowUser when clicking Following', async () => {
      mockApi.unfollowUser.mockResolvedValue({ message: 'Success' });
      const onFollowChange = vi.fn();

      render(
        <FollowButton
          userId="user-123"
          isFollowing={true}
          onFollowChange={onFollowChange}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockApi.unfollowUser).toHaveBeenCalledWith('user-123');
        expect(onFollowChange).toHaveBeenCalledWith(false);
      });
    });

    it('should disable button while loading', async () => {
      mockApi.followUser.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<FollowButton userId="user-123" isFollowing={false} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('...');
    });

    it('should handle API error gracefully', async () => {
      mockApi.followUser.mockRejectedValue(new Error('API Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<FollowButton userId="user-123" isFollowing={false} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Button should still show Follow (not changed)
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('styling', () => {
    it('should have pod-red background when not following', () => {
      render(<FollowButton userId="user-123" isFollowing={false} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-pod-red');
    });

    it('should have pod-red background when touch shows Unfollow', () => {
      render(<FollowButton userId="user-123" isFollowing={true} />);
      const button = screen.getByRole('button', { name: 'Unfollow' });
      expect(button).toHaveClass('bg-pod-red');
    });
  });
});

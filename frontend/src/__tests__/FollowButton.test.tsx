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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render Follow button when not following', () => {
      render(<FollowButton userId="user-123" isFollowing={false} />);
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    });

    it('should render Following button when following', () => {
      render(<FollowButton userId="user-123" isFollowing={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Following');
    });

    it('should render with sm size', () => {
      render(<FollowButton userId="user-123" isFollowing={false} size="sm" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3', 'py-1', 'text-sm');
    });

    it('should render with md size by default', () => {
      render(<FollowButton userId="user-123" isFollowing={false} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2');
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

    it('should have pod-active background when following', () => {
      render(<FollowButton userId="user-123" isFollowing={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-pod-active');
    });
  });
});

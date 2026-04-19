import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareModal } from '../components/ShareModal';
import { api } from '../lib/api';
import type { Recording } from '../types';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    updateRecording: vi.fn(),
  },
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('ShareModal Component', () => {
  const mockApi = api as unknown as {
    updateRecording: ReturnType<typeof vi.fn>;
  };

  const mockRecording: Recording = {
    id: 'rec-1',
    roomId: 'room-1',
    fileUrl: 'https://example.com/file.mp3',
    durationSeconds: 300,
    fileSizeBytes: 5000000,
    format: 'mp3',
    createdAt: '2024-01-15T10:00:00Z',
    title: 'Test Recording',
    description: 'Test description',
    isPublic: false,
    shareSlug: undefined,
  };

  const defaultProps = {
    recording: mockRecording,
    isOpen: true,
    onClose: vi.fn(),
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when closed', () => {
      render(<ShareModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Share Recording')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(<ShareModal {...defaultProps} />);
      expect(screen.getByText('Share Recording')).toBeInTheDocument();
    });

    it('should show title input with current value', () => {
      render(<ShareModal {...defaultProps} />);
      const titleInput = screen.getByPlaceholderText('Recording title');
      expect(titleInput).toHaveValue('Test Recording');
    });

    it('should show description textarea with current value', () => {
      render(<ShareModal {...defaultProps} />);
      const descInput = screen.getByPlaceholderText('Add a description...');
      expect(descInput).toHaveValue('Test description');
    });

    it('should show Make Public toggle', () => {
      render(<ShareModal {...defaultProps} />);
      expect(screen.getByText('Make Public')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClose when cancel is clicked', () => {
      render(<ShareModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when X button is clicked', () => {
      render(<ShareModal {...defaultProps} />);
      // Find the close button (first button in the header with SVG)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn => btn.querySelector('svg'));
      expect(closeButton).toBeTruthy();
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });

    it('should update title on input change', () => {
      render(<ShareModal {...defaultProps} />);
      const titleInput = screen.getByPlaceholderText('Recording title');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });
      expect(titleInput).toHaveValue('New Title');
    });

    it('should toggle public state', () => {
      render(<ShareModal {...defaultProps} />);
      const toggleContainer = screen.getByText('Make Public').closest('div')?.parentElement;
      const toggleButton = toggleContainer?.querySelector('button');

      expect(toggleButton).toHaveClass('bg-pod-active'); // Not public

      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(toggleButton).toHaveClass('bg-pod-red'); // Public
      }
    });
  });

  describe('saving', () => {
    it('should call updateRecording on save', async () => {
      mockApi.updateRecording.mockResolvedValue({
        ...mockRecording,
        title: 'Updated Title',
      });

      render(<ShareModal {...defaultProps} />);

      const titleInput = screen.getByPlaceholderText('Recording title');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockApi.updateRecording).toHaveBeenCalledWith('rec-1', {
          title: 'Updated Title',
          description: 'Test description',
          isPublic: false,
        });
      });
    });

    it('should call onUpdate with updated recording', async () => {
      const updatedRecording = {
        ...mockRecording,
        title: 'Updated Title',
        isPublic: true,
        shareSlug: 'abc123',
      };
      mockApi.updateRecording.mockResolvedValue(updatedRecording);

      render(<ShareModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalledWith(updatedRecording);
      });
    });

    it('should show loading state while saving', async () => {
      mockApi.updateRecording.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ShareModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Save'));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('share URL display', () => {
    const publicRecording: Recording = {
      ...mockRecording,
      isPublic: true,
      shareSlug: 'test-slug-123',
    };

    it('should show share URL when public with shareSlug', () => {
      render(<ShareModal {...defaultProps} recording={publicRecording} />);

      expect(screen.getByText('Share Link')).toBeInTheDocument();
      // Check that share link input exists (it should contain the listen URL)
      const inputs = screen.getAllByRole('textbox');
      const shareLinkInput = inputs.find(input =>
        (input as HTMLInputElement).value.includes('/listen/test-slug-123')
      );
      expect(shareLinkInput).toBeTruthy();
    });

    it('should show embed code when public', () => {
      render(<ShareModal {...defaultProps} recording={publicRecording} />);

      expect(screen.getByText('Embed Code')).toBeInTheDocument();
    });

    it('should copy share URL to clipboard', async () => {
      render(<ShareModal {...defaultProps} recording={publicRecording} />);

      const copyButtons = screen.getAllByText('Copy');
      fireEvent.click(copyButtons[0]); // First Copy button is for share URL

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('/listen/test-slug-123')
        );
      });
    });

    it('should not show share URL when not public', () => {
      render(<ShareModal {...defaultProps} />);
      expect(screen.queryByText('Share Link')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle API error gracefully', async () => {
      mockApi.updateRecording.mockRejectedValue(new Error('API Error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ShareModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});

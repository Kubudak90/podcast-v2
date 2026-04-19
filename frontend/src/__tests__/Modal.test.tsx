import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../components/UI/Modal';

describe('Modal Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  afterEach(() => {
    // Clean up body style
    document.body.style.overflow = '';
  });

  describe('visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={mockOnClose}>
          Modal Content
        </Modal>
      );
      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Modal Content
        </Modal>
      );
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });
  });

  describe('title', () => {
    it('should render title when provided', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
          Content
        </Modal>
      );
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should not render title section when not provided', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(container.querySelector('h2')).not.toBeInTheDocument();
    });

    it('should render close button in title section', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
          Content
        </Modal>
      );
      // Close button has an SVG with X icon
      const closeButtons = screen.getAllByRole('button');
      expect(closeButtons.length).toBeGreaterThan(0);
    });
  });

  describe('closing behavior', () => {
    it('should call onClose when clicking backdrop', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      // Find backdrop (the semi-transparent overlay)
      const backdrop = document.querySelector('.bg-black\\/70');
      fireEvent.click(backdrop!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when pressing Escape key', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking close button', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Title">
          Content
        </Modal>
      );
      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for non-Escape keys', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('body scroll lock', () => {
    it('should lock body scroll when modal opens', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should unlock body scroll when modal closes', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('content rendering', () => {
    it('should render children content', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div data-testid="child-content">Child Content</div>
        </Modal>
      );
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should render complex children', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Form">
          <form>
            <input placeholder="Username" />
            <button type="submit">Submit</button>
          </form>
        </Modal>
      );
      expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper structure with backdrop and content', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Accessible Modal">
          Content
        </Modal>
      );
      // Modal container should be present
      expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
      // Backdrop should be present
      expect(container.querySelector('.bg-black\\/70')).toBeInTheDocument();
      // Content area should be present
      expect(container.querySelector('.bg-pod-elevated')).toBeInTheDocument();
    });
  });
});

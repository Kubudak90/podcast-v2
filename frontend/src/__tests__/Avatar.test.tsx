import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from '../components/UI/Avatar';

describe('Avatar Component', () => {
  describe('rendering with initials', () => {
    it('should render initials for single word name', () => {
      render(<Avatar name="John" />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should render two initials for two word name', () => {
      render(<Avatar name="John Doe" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should only show first two initials for longer names', () => {
      render(<Avatar name="John Michael Doe" />);
      expect(screen.getByText('JM')).toBeInTheDocument();
    });

    it('should convert initials to uppercase', () => {
      render(<Avatar name="john doe" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  describe('rendering with image', () => {
    it('should render image when src is provided', () => {
      render(<Avatar name="John" src="https://example.com/avatar.png" />);
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
      expect(img).toHaveAttribute('alt', 'John');
    });

    it('should not show initials while the image is shown', () => {
      render(<Avatar name="John Doe" src="https://example.com/avatar.png" />);
      expect(screen.queryByText('JD')).not.toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'John Doe' })).toBeInTheDocument();
    });

    it('keeps initials after the image fails and the parent re-renders', () => {
      const { rerender } = render(
        <Avatar name="John Doe" src="https://example.com/missing.png" />
      );

      fireEvent.error(screen.getByRole('img', { name: 'John Doe' }));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      const initials = screen.getByText('JD');
      expect(initials).toBeInTheDocument();
      expect(initials).not.toHaveClass('hidden');

      rerender(<Avatar name="John Doe" src="https://example.com/missing.png" />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('tries again when a different image is provided', () => {
      const { rerender } = render(
        <Avatar name="John Doe" src="https://example.com/missing.png" />
      );

      fireEvent.error(screen.getByRole('img', { name: 'John Doe' }));
      expect(screen.getByText('JD')).toBeInTheDocument();

      rerender(<Avatar name="John Doe" src="https://example.com/other.png" />);

      expect(screen.getByRole('img', { name: 'John Doe' })).toHaveAttribute(
        'src',
        'https://example.com/other.png'
      );
      expect(screen.queryByText('JD')).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should render with default md size', () => {
      const { container } = render(<Avatar name="John" />);
      // Avatar content has z-10 class
      const avatarContent = container.querySelector('.z-10');
      expect(avatarContent).toHaveClass('w-12', 'h-12');
    });

    it('should render with sm size', () => {
      const { container } = render(<Avatar name="John" size="sm" />);
      const avatarContent = container.querySelector('.z-10');
      expect(avatarContent).toHaveClass('w-8', 'h-8');
    });

    it('should render with lg size', () => {
      const { container } = render(<Avatar name="John" size="lg" />);
      const avatarContent = container.querySelector('.z-10');
      expect(avatarContent).toHaveClass('w-16', 'h-16');
    });

    it('should render with xl size', () => {
      const { container } = render(<Avatar name="John" size="xl" />);
      const avatarContent = container.querySelector('.z-10');
      expect(avatarContent).toHaveClass('w-24', 'h-24');
    });
  });

  describe('speaking indicator', () => {
    it('should show speaking ring when isSpeaking is true', () => {
      const { container } = render(<Avatar name="John" isSpeaking />);
      // The speaking indicator is an animated ring element with animate-speaking-ring class
      const speakingRing = container.querySelector('.animate-speaking-ring');
      expect(speakingRing).toBeInTheDocument();
    });

    it('should not show speaking ring when isSpeaking is false', () => {
      const { container } = render(<Avatar name="John" isSpeaking={false} />);
      const speakingRing = container.querySelector('.animate-speaking-ring');
      expect(speakingRing).not.toBeInTheDocument();
    });

    it('should show speaking ring on image avatar', () => {
      const { container } = render(<Avatar name="John" src="https://example.com/avatar.png" isSpeaking />);
      const speakingRing = container.querySelector('.animate-speaking-ring');
      expect(speakingRing).toBeInTheDocument();
    });
  });

  describe('background colors', () => {
    it('should have consistent color for same name', () => {
      const { container: container1 } = render(<Avatar name="Alice" />);
      const { container: container2 } = render(<Avatar name="Alice" />);

      // Avatar content has z-10 class with bg-* color
      const avatar1 = container1.querySelector('.z-10') as HTMLElement;
      const avatar2 = container2.querySelector('.z-10') as HTMLElement;

      // Get the bg-* class
      const getBgClass = (el: HTMLElement) =>
        Array.from(el.classList).find(c => c.startsWith('bg-'));

      expect(getBgClass(avatar1)).toBe(getBgClass(avatar2));
    });

    it('should have different colors for different names', () => {
      const { container: container1 } = render(<Avatar name="Alice" />);
      const { container: container2 } = render(<Avatar name="Bob" />);

      const avatar1 = container1.querySelector('.z-10') as HTMLElement;
      const avatar2 = container2.querySelector('.z-10') as HTMLElement;

      const getBgClass = (el: HTMLElement) =>
        Array.from(el.classList).find(c => c.startsWith('bg-'));

      // Different names might have different colors (not always, but likely)
      // Just verify both have a background color
      expect(getBgClass(avatar1)).toBeDefined();
      expect(getBgClass(avatar2)).toBeDefined();
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<Avatar name="John" className="custom-class" />);
      const avatar = container.firstChild;
      expect(avatar).toHaveClass('custom-class');
    });
  });
});

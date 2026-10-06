import { useState, useRef, useEffect, useCallback } from 'react';

interface VolumeSliderProps {
  value: number; // 0-1 arasi
  onChange: (value: number) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const STEP = 0.05;
const PAGE_STEP = 0.1;
const DEFAULT_UNMUTE = 0.7;

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function VolumeSlider({
  value,
  onChange,
  disabled = false,
  orientation = 'horizontal',
  size = 'md',
  showIcon = true,
  className = ''
}: VolumeSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const lastAudibleRef = useRef(value > 0 ? value : DEFAULT_UNMUTE);

  const isVertical = orientation === 'vertical';
  const isMuted = value === 0;
  const percent = Math.round(clampVolume(value) * 100);

  useEffect(() => {
    if (value > 0) lastAudibleRef.current = value;
  }, [value]);

  const handleChange = useCallback((clientX: number, clientY: number) => {
    if (!sliderRef.current || disabled) return;

    const rect = sliderRef.current.getBoundingClientRect();
    let newValue: number;

    if (isVertical) {
      newValue = 1 - (clientY - rect.top) / rect.height;
    } else {
      newValue = (clientX - rect.left) / rect.width;
    }

    onChange(clampVolume(newValue));
  }, [disabled, isVertical, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleChange(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    const touch = e.touches[0];
    handleChange(touch.clientX, touch.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + STEP;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - STEP;
        break;
      case 'PageUp':
        next = value + PAGE_STEP;
        break;
      case 'PageDown':
        next = value - PAGE_STEP;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange(clampVolume(next));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleChange(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (e.cancelable) e.preventDefault();
      handleChange(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleChange]);

  const toggleMute = () => {
    if (disabled) return;
    if (isMuted) {
      const restore = lastAudibleRef.current > 0 ? lastAudibleRef.current : DEFAULT_UNMUTE;
      onChange(clampVolume(restore));
      return;
    }
    onChange(0);
  };

  const trackThickness = size === 'sm' ? 'h-1' : 'h-2';
  const verticalThickness = size === 'sm' ? 'w-1' : 'w-2';
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div
      className={`flex items-center gap-2 ${isVertical ? 'flex-col-reverse' : ''} ${className}`}
    >
      {showIcon && (
        <button
          type="button"
          onClick={toggleMute}
          disabled={disabled}
          aria-label={isMuted ? 'Sesi aç' : 'Sesi kapat'}
          aria-pressed={isMuted}
          className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg text-pod-text-secondary hover:text-white transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pod-red"
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : value < 0.5 ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 5.343a1 1 0 011.414 0A6.962 6.962 0 0118 10a6.962 6.962 0 01-1.929 4.657 1 1 0 11-1.414-1.414A4.967 4.967 0 0016 10c0-1.38-.56-2.63-1.464-3.536a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 5.343a1 1 0 011.414 0A6.962 6.962 0 0118 10a6.962 6.962 0 01-1.929 4.657 1 1 0 11-1.414-1.414A4.967 4.967 0 0016 10c0-1.38-.56-2.63-1.464-3.536a1 1 0 010-1.414zM12.828 7.172a1 1 0 011.414 0A3.98 3.98 0 0115 10a3.98 3.98 0 01-.758 2.343 1 1 0 01-1.485-1.343A1.98 1.98 0 0013 10c0-.548-.22-1.044-.576-1.405a1 1 0 01.404-1.423z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      )}

      <div
        ref={sliderRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Ses"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={isMuted ? 'Sessiz' : `${percent}%`}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`
          relative cursor-pointer touch-none rounded-full
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pod-red
          ${isVertical ? 'w-11 h-24' : 'h-11 w-24'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div
          className={`
            absolute rounded-full bg-pod-active left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            ${isVertical ? `h-full ${verticalThickness}` : `w-full ${trackThickness}`}
          `}
        />

        <div
          className={`
            absolute rounded-full bg-pod-red transition-all duration-75
            ${isVertical
              ? `left-1/2 bottom-0 -translate-x-1/2 ${verticalThickness}`
              : `left-0 top-1/2 -translate-y-1/2 ${trackThickness}`}
          `}
          style={isVertical ? { height: `${percent}%` } : { width: `${percent}%` }}
        />

        <div
          className={`absolute ${thumbSize} rounded-full bg-white shadow-md transition-transform duration-75 pointer-events-none`}
          style={
            isVertical
              ? {
                  left: '50%',
                  bottom: `${percent}%`,
                  transform: `translate(-50%, 50%)${isDragging ? ' scale(1.25)' : ''}`,
                }
              : {
                  top: '50%',
                  left: `${percent}%`,
                  transform: `translate(-50%, -50%)${isDragging ? ' scale(1.25)' : ''}`,
                }
          }
        />
      </div>
    </div>
  );
}

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

  const isVertical = orientation === 'vertical';
  const isMuted = value === 0;

  const handleChange = useCallback((clientX: number, clientY: number) => {
    if (!sliderRef.current || disabled) return;

    const rect = sliderRef.current.getBoundingClientRect();
    let newValue: number;

    if (isVertical) {
      newValue = 1 - (clientY - rect.top) / rect.height;
    } else {
      newValue = (clientX - rect.left) / rect.width;
    }

    onChange(Math.max(0, Math.min(1, newValue)));
  }, [disabled, isVertical, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleChange(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    handleChange(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleChange(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleChange(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
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
    onChange(isMuted ? 0.7 : 0);
  };

  const sliderSize = size === 'sm' ? 'h-1' : 'h-2';
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div
      className={`flex items-center gap-2 ${isVertical ? 'flex-col-reverse' : ''} ${className}`}
    >
      {showIcon && (
        <button
          onClick={toggleMute}
          disabled={disabled}
          className="text-pod-text-secondary hover:text-white transition-colors disabled:opacity-50"
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : value < 0.5 ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 5.343a1 1 0 011.414 0A6.962 6.962 0 0118 10a6.962 6.962 0 01-1.929 4.657 1 1 0 11-1.414-1.414A4.967 4.967 0 0016 10c0-1.38-.56-2.63-1.464-3.536a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`
          relative cursor-pointer
          ${isVertical ? 'w-2 h-24' : 'w-24 ' + sliderSize}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Background track */}
        <div
          className={`
            absolute rounded-full bg-pod-active
            ${isVertical ? 'w-full h-full' : 'w-full h-full'}
          `}
        />

        {/* Filled track */}
        <div
          className="absolute rounded-full bg-pod-red transition-all duration-75"
          style={
            isVertical
              ? { width: '100%', height: `${value * 100}%`, bottom: 0 }
              : { height: '100%', width: `${value * 100}%` }
          }
        />

        {/* Thumb */}
        <div
          className={`
            absolute ${thumbSize} rounded-full bg-white shadow-md
            transform -translate-x-1/2 -translate-y-1/2
            transition-transform duration-75
            ${isDragging ? 'scale-125' : 'scale-100'}
          `}
          style={
            isVertical
              ? { left: '50%', bottom: `${value * 100}%`, transform: 'translate(-50%, 50%)' }
              : { top: '50%', left: `${value * 100}%` }
          }
        />
      </div>
    </div>
  );
}

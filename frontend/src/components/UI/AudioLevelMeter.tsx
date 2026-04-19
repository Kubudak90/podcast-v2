interface AudioLevelMeterProps {
  level: number; // 0-1 arasi
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  barCount?: number;
  showPeak?: boolean;
  className?: string;
}

export function AudioLevelMeter({
  level,
  orientation = 'horizontal',
  size = 'md',
  barCount = 10,
  showPeak = false,
  className = ''
}: AudioLevelMeterProps) {
  const isVertical = orientation === 'vertical';

  const barSizes = {
    sm: isVertical ? 'w-1 h-1' : 'w-1 h-2',
    md: isVertical ? 'w-1.5 h-1.5' : 'w-1.5 h-3',
    lg: isVertical ? 'w-2 h-2' : 'w-2 h-4',
  };

  const gapSizes = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1',
  };

  const getBarColor = (index: number, total: number) => {
    const threshold = index / total;
    if (threshold > 0.8) return 'bg-red-500';
    if (threshold > 0.6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const activeBarCount = Math.round(level * barCount);

  return (
    <div
      className={`
        flex ${gapSizes[size]}
        ${isVertical ? 'flex-col-reverse' : 'flex-row'}
        ${className}
      `}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const isActive = i < activeBarCount;
        const isPeak = showPeak && i === activeBarCount - 1 && level > 0;

        return (
          <div
            key={i}
            className={`
              ${barSizes[size]} rounded-sm transition-all duration-75
              ${isActive ? getBarColor(i, barCount) : 'bg-pod-active'}
              ${isPeak ? 'opacity-100' : isActive ? 'opacity-90' : 'opacity-50'}
            `}
          />
        );
      })}
    </div>
  );
}

// Compact circle indicator for small spaces
interface AudioLevelDotProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AudioLevelDot({ level, size = 'md', className = '' }: AudioLevelDotProps) {
  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const getColor = () => {
    if (level > 0.8) return 'bg-red-500';
    if (level > 0.5) return 'bg-yellow-500';
    if (level > 0.1) return 'bg-green-500';
    return 'bg-pod-active';
  };

  return (
    <div
      className={`${dotSizes[size]} rounded-full transition-all duration-100 ${getColor()} ${className}`}
      style={{
        transform: `scale(${1 + level * 0.3})`,
        opacity: level > 0.05 ? 1 : 0.5,
      }}
    />
  );
}

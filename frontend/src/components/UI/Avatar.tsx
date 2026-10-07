import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  audioLevel?: number;
  showAudioLevel?: boolean;
  className?: string;
}

export function Avatar({
  src,
  name,
  size = 'md',
  isSpeaking,
  audioLevel = 0,
  showAudioLevel = false,
  className = ''
}: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  const ringSize = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const ringOpacity = isSpeaking ? Math.max(0.5, audioLevel) : 0;
  const ringScale = isSpeaking ? 1 + (audioLevel * 0.2) : 1;

  // A failed image must stay failed across parent re-renders. Hiding the
  // <img> with DOM style and unhiding initials with classList is undone the
  // next time React reconciles (listen timeupdate, new chat message), which
  // left an empty tile.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  const tileClass = `${sizes[size]} rounded-lg relative z-10`;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {isSpeaking && (
        <>
          <div
            className={`absolute ${ringSize[size]} rounded-lg bg-pod-red animate-speaking-ring`}
            style={{ opacity: ringOpacity * 0.3 }}
          />
          <div
            className={`absolute ${sizes[size]} rounded-lg border-2 border-pod-red animate-speaking-pulse`}
            style={{
              transform: `scale(${ringScale})`,
              opacity: ringOpacity,
              transition: 'transform 0.1s ease-out'
            }}
          />
        </>
      )}

      {showImage ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          className={`${tileClass} object-cover`}
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <div
          className={`${tileClass} bg-pod-elevated flex items-center justify-center font-bold text-white border border-pod-border`}
          title={name}
        >
          {initials || '?'}
        </div>
      )}

      {showAudioLevel && isSpeaking && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 bg-pod-red rounded-full audio-wave-bar"
              style={{
                height: `${Math.max(4, audioLevel * 12)}px`,
                animationDelay: `${i * 0.15}s`,
                opacity: audioLevel > 0.1 ? 1 : 0.3
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

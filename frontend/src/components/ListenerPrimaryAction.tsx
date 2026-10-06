interface ListenerPrimaryActionProps {
  isSpeaker: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function ListenerPrimaryAction({ isSpeaker, isMuted, onToggleMute }: ListenerPrimaryActionProps) {
  if (isSpeaker) {
    return (
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Mikrofonu ac' : 'Mikrofonu kapat'}
        className="flex-1 h-14 flex flex-col items-center justify-center gap-1 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors"
      >
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
        <span className="text-[10px] font-semibold text-white tracking-wider">{isMuted ? 'MIC OFF' : 'MIC ON'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex-1 h-14 flex flex-col items-center justify-center gap-1 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors"
    >
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
      <span className="text-[10px] font-semibold text-white tracking-wider">REQUEST</span>
    </button>
  );
}

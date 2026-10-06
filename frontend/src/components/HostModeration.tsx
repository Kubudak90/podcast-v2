import type { RoomMember } from '../types';

interface HostModerationBarProps {
  member: RoomMember;
  busy: boolean;
  confirmRemove: boolean;
  onMute: () => void;
  onUnmute: () => void;
  onRemove: () => void;
}

export function HostModerationBar({
  member,
  busy,
  confirmRemove,
  onMute,
  onUnmute,
  onRemove,
}: HostModerationBarProps) {
  return (
    <div className="px-6 mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-white mr-1">@{member.username}</span>
      {member.role === 'speaker' && (
        member.mutedByHost ? (
          <button
            type="button"
            disabled={busy}
            onClick={onUnmute}
            className="min-h-11 px-4 rounded-lg bg-pod-elevated border border-pod-border text-xs font-semibold tracking-wider text-white disabled:opacity-50"
          >
            UNMUTE
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onMute}
            className="min-h-11 px-4 rounded-lg bg-pod-elevated border border-pod-border text-xs font-semibold tracking-wider text-white disabled:opacity-50"
          >
            MUTE
          </button>
        )
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="min-h-11 px-4 rounded-lg border border-pod-red text-xs font-semibold tracking-wider text-pod-red disabled:opacity-50"
      >
        {confirmRemove ? 'CONFIRM REMOVE' : 'REMOVE'}
      </button>
    </div>
  );
}

interface UnmuteRequestListProps {
  requests: { userId: string; username: string }[];
  busy: boolean;
  onAllow: (userId: string) => void;
}

export function UnmuteRequestList({ requests, busy, onAllow }: UnmuteRequestListProps) {
  if (requests.length === 0) return null;

  return (
    <div className="px-6 mb-4 space-y-2">
      {requests.map((request) => (
        <div
          key={request.userId}
          className="flex items-center justify-between gap-3 border border-pod-border rounded-xl px-4 py-3"
        >
          <p className="text-sm text-white">@{request.username} konusmak istiyor</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAllow(request.userId)}
            className="min-h-11 px-4 rounded-lg bg-pod-red text-xs font-semibold tracking-wider text-white disabled:opacity-50"
          >
            ALLOW
          </button>
        </div>
      ))}
    </div>
  );
}

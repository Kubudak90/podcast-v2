import { useEffect } from 'react';
import { useParticipants } from '@livekit/components-react';
import { useAudioSettingsStore } from '../lib/store';

function withVolume(participant: { setVolume?: unknown; identity: string }): participant is {
  setVolume: (volume: number) => void;
  identity: string;
} {
  return typeof participant.setVolume === 'function';
}

/** Applies per-person volume, and silence, to remote microphone audio. */
export function RemoteAudioGains({ blockedUsernames }: { blockedUsernames: ReadonlySet<string> }) {
  const participants = useParticipants();
  const participantVolumes = useAudioSettingsStore((state) => state.participantVolumes);

  useEffect(() => {
    for (const participant of participants) {
      if (!withVolume(participant)) continue;
      const volume = blockedUsernames.has(participant.identity)
        ? 0
        : (participantVolumes[participant.identity] ?? 1);
      participant.setVolume(volume);
    }
  }, [participants, blockedUsernames, participantVolumes]);

  return null;
}

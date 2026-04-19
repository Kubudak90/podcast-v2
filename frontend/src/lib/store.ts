import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Room } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      updateUser: (user) =>
        set({ user }),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface RoomState {
  currentRoom: Room | null;
  currentRoomPassword: string | null;
  isHost: boolean;
  isSpeaker: boolean;
  isMuted: boolean;
  setCurrentRoom: (room: Room | null) => void;
  setCurrentRoomPassword: (password: string | null) => void;
  setIsHost: (isHost: boolean) => void;
  setIsSpeaker: (isSpeaker: boolean) => void;
  setIsMuted: (isMuted: boolean) => void;
  toggleMute: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  currentRoomPassword: null,
  isHost: false,
  isSpeaker: false,
  isMuted: false,
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentRoomPassword: (currentRoomPassword) => set({ currentRoomPassword }),
  setIsHost: (isHost) => set({ isHost }),
  setIsSpeaker: (isSpeaker) => set({ isSpeaker }),
  setIsMuted: (isMuted) => set({ isMuted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  reset: () =>
    set({
      currentRoom: null,
      currentRoomPassword: null,
      isHost: false,
      isSpeaker: false,
      isMuted: true,
    }),
}));

// Ses ayarlari state'i
interface AudioSettingsState {
  masterVolume: number; // 0-1
  participantVolumes: Record<string, number>; // participantId -> volume (0-1)
  setMasterVolume: (volume: number) => void;
  setParticipantVolume: (participantId: string, volume: number) => void;
  resetVolumes: () => void;
}

export const useAudioSettingsStore = create<AudioSettingsState>()(
  persist(
    (set) => ({
      masterVolume: 1,
      participantVolumes: {},
      setMasterVolume: (volume) => set({ masterVolume: volume }),
      setParticipantVolume: (participantId, volume) =>
        set((state) => ({
          participantVolumes: {
            ...state.participantVolumes,
            [participantId]: volume,
          },
        })),
      resetVolumes: () => set({ masterVolume: 1, participantVolumes: {} }),
    }),
    {
      name: 'audio-settings',
    }
  )
);

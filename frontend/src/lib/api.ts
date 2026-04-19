import type { User, Room, Recording, AuthResponse, LiveKitTokenResponse, RoomHistoryItem, PublicRoomsResponse, UserProfile, FollowUser, PublicRecording, RecordingFeedResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      const err = new Error(error.message || `HTTP error ${response.status}`) as Error & { requiresPassword?: boolean };
      err.requiresPassword = error.requiresPassword;
      throw err;
    }

    return response.json();
  }

  // Auth
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async authenticateWithGoogle(token: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async authenticateWithApple(token: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async me(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateProfile(data: { username?: string; email?: string | null; bio?: string | null; avatarUrl?: string | null }): Promise<User> {
    return this.request<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getRoomHistory(limit?: number, offset?: number): Promise<RoomHistoryItem[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const query = params.toString();
    return this.request<RoomHistoryItem[]>(`/auth/rooms${query ? `?${query}` : ''}`);
  }

  // Rooms
  async getPublicRooms(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: 'live' | 'waiting';
  }): Promise<PublicRoomsResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.search) params.set('search', options.search);
    if (options?.status) params.set('status', options.status);
    const query = params.toString();
    return this.request<PublicRoomsResponse>(`/rooms${query ? `?${query}` : ''}`);
  }

  async createRoom(title: string, isPublic: boolean = true, password?: string): Promise<Room> {
    return this.request<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ title, isPublic, password }),
    });
  }

  async getRoom(slug: string): Promise<Room> {
    return this.request<Room>(`/rooms/${slug}`);
  }

  async joinRoom(slug: string, password?: string): Promise<{ room: Room; participant: { role: string } }> {
    return this.request(`/rooms/${slug}/join`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async leaveRoom(slug: string): Promise<void> {
    return this.request(`/rooms/${slug}/leave`, { method: 'POST' });
  }

  async startRoom(slug: string): Promise<Room> {
    return this.request<Room>(`/rooms/${slug}/start`, { method: 'POST' });
  }

  async endRoom(slug: string): Promise<Room> {
    return this.request<Room>(`/rooms/${slug}/end`, { method: 'POST' });
  }

  async changeRole(slug: string, userId: string, role: 'speaker' | 'listener'): Promise<void> {
    return this.request(`/rooms/${slug}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, role }),
    });
  }

  // Recordings
  async getRoomRecordings(slug: string): Promise<Recording[]> {
    return this.request<Recording[]>(`/rooms/${slug}/recordings`);
  }

  async getRecordingDownloadUrl(recordingId: string): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/recordings/${recordingId}/download`);
  }

  // LiveKit
  async getLiveKitToken(roomSlug: string): Promise<LiveKitTokenResponse> {
    return this.request<LiveKitTokenResponse>('/livekit/token', {
      method: 'POST',
      body: JSON.stringify({ roomSlug }),
    });
  }

  // Users
  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.request<UserProfile>(`/users/${userId}`);
  }

  async followUser(userId: string): Promise<{ message: string }> {
    return this.request(`/users/${userId}/follow`, {
      method: 'POST',
    });
  }

  async unfollowUser(userId: string): Promise<{ message: string }> {
    return this.request(`/users/${userId}/follow`, {
      method: 'DELETE',
    });
  }

  async getFollowers(userId: string, limit?: number, offset?: number): Promise<FollowUser[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const query = params.toString();
    return this.request<FollowUser[]>(`/users/${userId}/followers${query ? `?${query}` : ''}`);
  }

  async getFollowing(userId: string, limit?: number, offset?: number): Promise<FollowUser[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const query = params.toString();
    return this.request<FollowUser[]>(`/users/${userId}/following${query ? `?${query}` : ''}`);
  }

  // Notifications
  async getVapidPublicKey(): Promise<{ publicKey: string }> {
    return this.request('/notifications/vapid-key');
  }

  async subscribeToPush(subscription: PushSubscriptionJSON): Promise<{ message: string }> {
    return this.request('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    });
  }

  async unsubscribeFromPush(endpoint: string): Promise<{ message: string }> {
    return this.request('/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  }

  // Recordings sharing
  async updateRecording(recordingId: string, data: { title?: string; description?: string; isPublic?: boolean }): Promise<Recording> {
    return this.request<Recording>(`/recordings/${recordingId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getPublicRecording(shareSlug: string): Promise<PublicRecording> {
    return this.request<PublicRecording>(`/recordings/public/${shareSlug}`);
  }

  async getPublicRecordingDownload(shareSlug: string): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/recordings/public/${shareSlug}/download`);
  }

  async getRecordingsFeed(limit?: number, offset?: number): Promise<RecordingFeedResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const query = params.toString();
    return this.request<RecordingFeedResponse>(`/recordings/feed${query ? `?${query}` : ''}`);
  }
}

export const api = new ApiClient();

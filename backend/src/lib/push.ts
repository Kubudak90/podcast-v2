import webpush from 'web-push';
import { prisma } from './prisma.js';
import { blockedUserIds } from './blocks.js';
import { logError } from './logger.js';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@podchat.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function getVapidPublicKey(): string | undefined {
  return vapidPublicKey;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return 0;
  }

  const subscriptions = await prisma.notificationSubscription.findMany({
    where: { userId },
  });

  let successCount = 0;
  const failedIds: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );
      successCount++;
    } catch (error) {
      // If subscription is expired or invalid, mark for removal
      const err = error as { statusCode?: number };
      if (err.statusCode === 410 || err.statusCode === 404) {
        failedIds.push(sub.id);
      } else {
        logError(error as Error, { action: 'send_push', userId, endpoint: sub.endpoint });
      }
    }
  }

  // Clean up invalid subscriptions
  if (failedIds.length > 0) {
    await prisma.notificationSubscription.deleteMany({
      where: { id: { in: failedIds } },
    });
  }

  return successCount;
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  let totalSuccess = 0;
  for (const userId of userIds) {
    totalSuccess += await sendPushToUser(userId, payload);
  }
  return totalSuccess;
}

/**
 * Send notification when a followed user goes live
 */
export async function notifyFollowersOfLive(
  hostId: string,
  hostUsername: string,
  roomTitle: string,
  roomSlug: string
): Promise<number> {
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    select: { isBanned: true },
  });
  if (!host || host.isBanned) return 0;

  const followers = await prisma.userFollow.findMany({
    where: { followingId: hostId },
    select: { followerId: true },
  });

  if (followers.length === 0) return 0;

  const blocked = new Set(await blockedUserIds(hostId));
  const candidateIds = followers
    .map((f) => f.followerId)
    .filter((id) => !blocked.has(id));

  if (candidateIds.length === 0) return 0;

  const active = await prisma.user.findMany({
    where: { id: { in: candidateIds }, isBanned: false },
    select: { id: true },
  });

  if (active.length === 0) return 0;

  return sendPushToUsers(active.map((u) => u.id), {
    title: `${hostUsername} is live!`,
    body: roomTitle,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `live-${roomSlug}`,
    data: {
      type: 'room_live',
      roomSlug,
      hostId,
    },
  });
}

/**
 * Send notification when someone follows the user
 */
export async function notifyNewFollower(
  userId: string,
  followerUsername: string,
  followerAvatarUrl?: string
): Promise<number> {
  const [target, follower] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } }),
    prisma.user.findUnique({
      where: { username: followerUsername },
      select: { id: true, isBanned: true },
    }),
  ]);
  if (!target || target.isBanned || !follower || follower.isBanned) return 0;

  const blocked = await blockedUserIds(userId);
  if (blocked.includes(follower.id)) return 0;

  return sendPushToUser(userId, {
    title: 'New follower',
    body: `${followerUsername} started following you`,
    icon: followerAvatarUrl || '/icon-192.png',
    tag: `follower-${followerUsername}`,
    data: {
      type: 'new_follower',
      followerUsername,
    },
  });
}

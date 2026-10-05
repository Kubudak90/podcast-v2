export function hiddenIdsFromBlockList(list: { blockedIds: string[]; hiddenUserIds?: string[] }): string[] {
  return list.hiddenUserIds ?? list.blockedIds;
}

export function visibleChatMessages<T extends { userId: string }>(
  messages: T[],
  hiddenUserIds: ReadonlySet<string>,
  selfUserId?: string | null,
): T[] {
  return messages.filter((message) => message.userId === selfUserId || !hiddenUserIds.has(message.userId));
}

export function usernamesForHiddenUsers(
  directory: Record<string, string>,
  hiddenUserIds: ReadonlySet<string>,
): Set<string> {
  const names = new Set<string>();
  for (const [username, userId] of Object.entries(directory)) {
    if (hiddenUserIds.has(userId)) names.add(username);
  }
  return names;
}

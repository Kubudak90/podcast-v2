export interface PublishPermission {
  canPublish?: boolean;
}

/** Listeners join with canPublish false. Missing permissions still count as on-mic. */
export function publishesAudio(permissions?: PublishPermission | null): boolean {
  return permissions?.canPublish !== false;
}

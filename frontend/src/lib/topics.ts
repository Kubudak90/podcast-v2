export const ROOM_TOPICS = [
  { id: 'technology', label: 'Technology', short: 'TECH' },
  { id: 'sports', label: 'Sports', short: 'SPORTS' },
  { id: 'music', label: 'Music', short: 'MUSIC' },
  { id: 'news', label: 'News', short: 'NEWS' },
  { id: 'comedy', label: 'Comedy', short: 'COMEDY' },
  { id: 'business', label: 'Business', short: 'BUSINESS' },
  { id: 'science', label: 'Science', short: 'SCIENCE' },
  { id: 'education', label: 'Education', short: 'EDUCATION' },
] as const;

export type RoomTopicId = (typeof ROOM_TOPICS)[number]['id'];

export function topicShortLabel(topic: string | null | undefined): string | null {
  if (!topic) return null;
  return ROOM_TOPICS.find((item) => item.id === topic)?.short ?? topic.toUpperCase();
}

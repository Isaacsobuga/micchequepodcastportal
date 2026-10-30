export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type ChatStatus = 'scheduled' | 'open' | 'closed';

export interface Profile {
  id: string;
  fan_id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  media_url: string | null;
  media_type: 'image' | 'video';
  video_url: string | null;
  action_label: string | null;
  action_url: string | null;
  status: EventStatus;
  is_featured: boolean;
  is_published: boolean;
}

export interface Episode {
  id: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string | null;
  description: string;
  guest_names: string;
  published_at: string | null;
  thumbnail_url: string | null;
  is_featured: boolean;
  is_published: boolean;
}

export interface Merchandise {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  price_text: string | null;
  external_url: string;
  is_featured: boolean;
  is_published: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  description: string;
  youtube_live_url: string | null;
  status: ChatStatus;
  starts_at: string | null;
  ends_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  body: string | null;
  created_at: string;
  profiles?: { display_name: string; fan_id: string } | null;
}

export interface SiteSetting {
  key: string;
  value: Record<string, string>;
}

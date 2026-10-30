/*
# Create Mic Cheque core platform schema

1. New Tables
- `profiles`: private fan profile fields and public-facing fan ID.
- `user_roles`: immutable-by-users admin, moderator, or fan roles.
- `events`: publishable event schedule and external actions.
- `episodes`: manually managed YouTube episodes.
- `tickets`: external ticket listings.
- `merchandise`: external shop listings.
- `saved_items`: per-user saved content.
- `chat_sessions`: host-controlled live community rooms.
- `chat_messages`: moderated messages in chat sessions.
- `chat_polls`: host-created polls.
- `chat_votes`: one vote per user and poll.
- `reports`: user-submitted moderation reports.
- `user_restrictions`: moderator-applied restrictions.
- `site_settings`: editable public links and support details.

2. Security
- RLS is enabled on every table.
- Public roles can only read published public content and public settings.
- Authenticated fans can only manage their own profiles, saves, messages, votes, and reports.
- Admin and moderator actions are checked with a SECURITY DEFINER role helper.
- Admin-only content changes cannot be performed by ordinary fans.

3. Important notes
- All timestamps are stored as timestamptz and rendered in Africa/Nairobi by the app.
- Public data is seeded only with verified destinations supplied for this project.
- No secrets are stored in site settings.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id text UNIQUE NOT NULL DEFAULT ('CM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  display_name text NOT NULL DEFAULT 'Cheque Mate',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'fan' CHECK (role IN ('fan', 'moderator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  media_url text,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  action_label text,
  action_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (action_url IS NULL OR action_url ~ '^https?://')
);

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  youtube_url text NOT NULL CHECK (youtube_url ~ '^https?://'),
  youtube_video_id text,
  description text NOT NULL DEFAULT '',
  guest_names text NOT NULL DEFAULT '',
  published_at timestamptz,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  price_text text,
  external_url text NOT NULL CHECK (external_url ~ '^https?://'),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchandise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  price_text text,
  external_url text NOT NULL CHECK (external_url ~ '^https?://'),
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('event', 'episode', 'merchandise')),
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  youtube_live_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'video')),
  body text,
  media_path text,
  is_pinned boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body IS NOT NULL OR media_path IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS chat_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz
);

CREATE TABLE IF NOT EXISTS chat_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('message', 'profile')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restriction_type text NOT NULL CHECK (restriction_type IN ('mute', 'block')),
  reason text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_public_order_idx ON events (is_published, starts_at);
CREATE INDEX IF NOT EXISTS episodes_public_order_idx ON episodes (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS merchandise_public_order_idx ON merchandise (is_published, is_featured DESC);
CREATE INDEX IF NOT EXISTS chat_messages_session_order_idx ON chat_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS reports_status_order_idx ON reports (status, created_at);

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(required_role text DEFAULT 'moderator')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR (required_role = 'moderator' AND role = 'moderator'))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (new.id, COALESCE(NULLIF(new.raw_user_meta_data->>'display_name', ''), 'Cheque Mate')) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'fan') ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchandise ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events, episodes, tickets, merchandise TO authenticated;
GRANT SELECT ON events, episodes, tickets, merchandise TO anon;
GRANT SELECT, INSERT, DELETE ON saved_items TO authenticated;
GRANT SELECT ON chat_sessions, chat_messages, chat_polls TO anon, authenticated;
GRANT INSERT ON chat_messages, chat_votes, reports TO authenticated;
GRANT SELECT ON chat_votes TO authenticated;
GRANT SELECT ON user_restrictions TO authenticated;
GRANT SELECT ON site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON events, episodes, tickets, merchandise, chat_sessions, chat_polls, user_restrictions, site_settings TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "roles_select_authenticated" ON user_roles;
CREATE POLICY "roles_select_authenticated" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_moderator('admin'));

DROP POLICY IF EXISTS "events_public_select" ON events;
CREATE POLICY "events_public_select" ON events FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "events_admin_insert" ON events;
CREATE POLICY "events_admin_insert" ON events FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "events_admin_update" ON events;
CREATE POLICY "events_admin_update" ON events FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('admin')) WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "events_admin_delete" ON events;
CREATE POLICY "events_admin_delete" ON events FOR DELETE TO authenticated USING (public.is_admin_or_moderator('admin'));

DROP POLICY IF EXISTS "episodes_public_select" ON episodes;
CREATE POLICY "episodes_public_select" ON episodes FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "episodes_admin_insert" ON episodes;
CREATE POLICY "episodes_admin_insert" ON episodes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "episodes_admin_update" ON episodes;
CREATE POLICY "episodes_admin_update" ON episodes FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('admin')) WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "episodes_admin_delete" ON episodes;
CREATE POLICY "episodes_admin_delete" ON episodes FOR DELETE TO authenticated USING (public.is_admin_or_moderator('admin'));

DROP POLICY IF EXISTS "tickets_public_select" ON tickets;
CREATE POLICY "tickets_public_select" ON tickets FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "tickets_admin_insert" ON tickets;
CREATE POLICY "tickets_admin_insert" ON tickets FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "tickets_admin_update" ON tickets;
CREATE POLICY "tickets_admin_update" ON tickets FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('admin')) WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "tickets_admin_delete" ON tickets;
CREATE POLICY "tickets_admin_delete" ON tickets FOR DELETE TO authenticated USING (public.is_admin_or_moderator('admin'));

DROP POLICY IF EXISTS "merch_public_select" ON merchandise;
CREATE POLICY "merch_public_select" ON merchandise FOR SELECT TO anon, authenticated USING (is_published = true OR public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "merch_admin_insert" ON merchandise;
CREATE POLICY "merch_admin_insert" ON merchandise FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "merch_admin_update" ON merchandise;
CREATE POLICY "merch_admin_update" ON merchandise FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('admin')) WITH CHECK (public.is_admin_or_moderator('admin'));
DROP POLICY IF EXISTS "merch_admin_delete" ON merchandise;
CREATE POLICY "merch_admin_delete" ON merchandise FOR DELETE TO authenticated USING (public.is_admin_or_moderator('admin'));

DROP POLICY IF EXISTS "saved_select_own" ON saved_items;
CREATE POLICY "saved_select_own" ON saved_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_insert_own" ON saved_items;
CREATE POLICY "saved_insert_own" ON saved_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_delete_own" ON saved_items;
CREATE POLICY "saved_delete_own" ON saved_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_public_select" ON chat_sessions;
CREATE POLICY "sessions_public_select" ON chat_sessions FOR SELECT TO anon, authenticated USING (status IN ('scheduled', 'open') OR public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "sessions_moderator_insert" ON chat_sessions;
CREATE POLICY "sessions_moderator_insert" ON chat_sessions FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "sessions_moderator_update" ON chat_sessions;
CREATE POLICY "sessions_moderator_update" ON chat_sessions FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('moderator')) WITH CHECK (public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "sessions_moderator_delete" ON chat_sessions;
CREATE POLICY "sessions_moderator_delete" ON chat_sessions FOR DELETE TO authenticated USING (public.is_admin_or_moderator('moderator'));

DROP POLICY IF EXISTS "messages_visible_select" ON chat_messages;
CREATE POLICY "messages_visible_select" ON chat_messages FOR SELECT TO anon, authenticated USING (moderation_status = 'visible' OR user_id = auth.uid() OR public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "messages_open_insert" ON chat_messages;
CREATE POLICY "messages_open_insert" ON chat_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND message_type = 'text' AND length(COALESCE(body, '')) BETWEEN 1 AND 1000 AND
  EXISTS (SELECT 1 FROM chat_sessions WHERE id = session_id AND status = 'open') AND
  NOT EXISTS (SELECT 1 FROM user_restrictions WHERE user_id = auth.uid() AND restriction_type IN ('mute', 'block') AND (ends_at IS NULL OR ends_at > now()))
);
DROP POLICY IF EXISTS "messages_moderator_update" ON chat_messages;
CREATE POLICY "messages_moderator_update" ON chat_messages FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('moderator')) WITH CHECK (public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "messages_moderator_delete" ON chat_messages;
CREATE POLICY "messages_moderator_delete" ON chat_messages FOR DELETE TO authenticated USING (public.is_admin_or_moderator('moderator'));

DROP POLICY IF EXISTS "polls_public_select" ON chat_polls;
CREATE POLICY "polls_public_select" ON chat_polls FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "polls_moderator_insert" ON chat_polls;
CREATE POLICY "polls_moderator_insert" ON chat_polls FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "polls_moderator_update" ON chat_polls;
CREATE POLICY "polls_moderator_update" ON chat_polls FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('moderator')) WITH CHECK (public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "polls_moderator_delete" ON chat_polls;
CREATE POLICY "polls_moderator_delete" ON chat_polls FOR DELETE TO authenticated USING (public.is_admin_or_moderator('moderator'));

DROP POLICY IF EXISTS "votes_select_authenticated" ON chat_votes;
CREATE POLICY "votes_select_authenticated" ON chat_votes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "votes_insert_own" ON chat_votes;
CREATE POLICY "votes_insert_own" ON chat_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM chat_polls WHERE id = poll_id AND status = 'open'));

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_select_own_or_moderator" ON reports;
CREATE POLICY "reports_select_own_or_moderator" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "reports_moderator_update" ON reports;
CREATE POLICY "reports_moderator_update" ON reports FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('moderator')) WITH CHECK (public.is_admin_or_moderator('moderator'));

DROP POLICY IF EXISTS "restrictions_select_own_or_moderator" ON user_restrictions;
CREATE POLICY "restrictions_select_own_or_moderator" ON user_restrictions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "restrictions_moderator_insert" ON user_restrictions;
CREATE POLICY "restrictions_moderator_insert" ON user_restrictions FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('moderator') AND auth.uid() = created_by);
DROP POLICY IF EXISTS "restrictions_moderator_update" ON user_restrictions;
CREATE POLICY "restrictions_moderator_update" ON user_restrictions FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('moderator')) WITH CHECK (public.is_admin_or_moderator('moderator'));
DROP POLICY IF EXISTS "restrictions_moderator_delete" ON user_restrictions;
CREATE POLICY "restrictions_moderator_delete" ON user_restrictions FOR DELETE TO authenticated USING (public.is_admin_or_moderator('moderator'));

DROP POLICY IF EXISTS "settings_public_select" ON site_settings;
CREATE POLICY "settings_public_select" ON site_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_admin_insert" ON site_settings;
CREATE POLICY "settings_admin_insert" ON site_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator('admin') AND auth.uid() = updated_by);
DROP POLICY IF EXISTS "settings_admin_update" ON site_settings;
CREATE POLICY "settings_admin_update" ON site_settings FOR UPDATE TO authenticated USING (public.is_admin_or_moderator('admin')) WITH CHECK (public.is_admin_or_moderator('admin') AND auth.uid() = updated_by);
DROP POLICY IF EXISTS "settings_admin_delete" ON site_settings;
CREATE POLICY "settings_admin_delete" ON site_settings FOR DELETE TO authenticated USING (public.is_admin_or_moderator('admin'));

INSERT INTO site_settings (key, value) VALUES
('quick_links', '{"fantasyLeague":"https://fantasy.premierleague.com/leagues/auto-join/ymfmrb","till":"8816044","support":"https://buymesoda.com/8SmaRG2eT1fKcq7D8O6uUK5KY0n2"}'::jsonb),
('official_links', '{"shop":"https://micchequepodcast.hustlesasa.shop/","linktree":"https://linktr.ee/micchequepodcast","youtube":"https://www.youtube.com/@UpSydDigitalNetworks","clips":"https://www.youtube.com/@UpSydDigitalNetworksClips","membership":"https://www.youtube.com/channel/UCE3KVkSH1GwUtAAMcVcJ3QQ/join","apple":"https://podcasts.apple.com/us/podcast/mic-cheque-podcast/id1613570041"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

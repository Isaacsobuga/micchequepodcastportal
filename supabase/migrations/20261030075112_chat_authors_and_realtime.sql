/*
# Show chat author names and enable live chat updates

1. Purpose
- Chat messages could not show who wrote them: the chat page asks for the author's profile, but no link existed between chat messages and profiles.
- Live chat messages were not published to Realtime, so new messages would not appear without a refresh.

2. Changes
- Adds a foreign key from chat_messages.user_id to profiles.id so the author's display name and fan ID can be loaded with each message.
- Replaces the signed-in-only profile read rule on profiles with a public read rule. Profile fields are public-facing by design (display name, fan ID, avatar); no private fields exist on profiles.
- Adds chat_messages to the supabase_realtime publication. Row Level Security still decides what each subscriber receives.

3. Security
- No write permissions change. Users still can only update their own display name and avatar.
- Anonymous visitors can read profile display fields only through the existing column grant.

4. Important notes
- Every existing chat message author already has a profile row created by the sign-up trigger, so the foreign key can be added without losing data.
*/

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_profile_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_profile_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT (id, fan_id, display_name, avatar_url) ON profiles TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

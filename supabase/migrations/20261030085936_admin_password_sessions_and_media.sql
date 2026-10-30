/*
# Password-based admin access, media storage, and content columns

1. New Tables (all private, no browser access)
- `admin_credentials`: one row holding a salted bcrypt hash of the admin password. The plain password is never stored.
- `admin_sessions`: hashed admin session tokens with an expiry time (12 hours).
- `admin_login_attempts`: records login attempts so repeated wrong guesses are throttled.

2. Functions (callable only by the server-side Edge Function using the service role)
- `admin_create_session(password)`: verifies the password, throttles after 10 failed attempts in 15 minutes, and returns a new random session token.
- `admin_session_valid(token)`: returns true only for an unexpired session.
- `admin_end_session(token)`: ends a session on logout.

3. Storage
- Creates the public `media` bucket for event posters, event videos, merchandise images, and episode covers. Only images (JPG, PNG, WebP, GIF) and videos (MP4, WebM) are allowed, with a 50 MB limit. Uploads are performed by the server only.

4. Content columns
- `episodes.thumbnail_url`: custom cover image or the YouTube thumbnail URL.
- `events.video_url`: optional event video. `events.media_url` remains the event poster.

5. Security
- RLS is enabled on the new private tables and no API role is granted access to them.
- Existing public read policies are unchanged.

6. Important notes
- The admin password hash is inserted separately so that the password itself never appears in migration files.
*/

CREATE TABLE IF NOT EXISTS admin_credentials (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_time_idx ON admin_login_attempts (attempted_at);

ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON admin_credentials, admin_sessions, admin_login_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_session(p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_token text;
BEGIN
  IF (SELECT count(*) FROM admin_login_attempts WHERE NOT succeeded AND attempted_at > now() - interval '15 minutes') >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Please wait 15 minutes and try again.' USING ERRCODE = 'P0001';
  END IF;

  SELECT password_hash INTO v_hash FROM admin_credentials WHERE id = 1;
  IF v_hash IS NULL OR p_password IS NULL OR crypt(p_password, v_hash) <> v_hash THEN
    INSERT INTO admin_login_attempts (succeeded) VALUES (false);
    RETURN NULL;
  END IF;

  INSERT INTO admin_login_attempts (succeeded) VALUES (true);
  DELETE FROM admin_sessions WHERE expires_at < now();

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO admin_sessions (token_hash, expires_at)
  VALUES (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now() + interval '12 hours');

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_session_valid(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_end_session(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM admin_sessions WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_session(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_session_valid(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_end_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_session_valid(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_end_session(text) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url text;

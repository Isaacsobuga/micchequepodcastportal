/*
# Hide the internal role helper from the public API

1. Purpose
- Move the SECURITY DEFINER role-check helper into a private schema so it cannot be called as a public REST RPC.

2. Security changes
- The existing RLS policies continue to use the same function object and authorization behavior.
- Anonymous users cannot execute the helper.
- The helper is no longer in the API-exposed public schema.

3. Important notes
- No tables, rows, or columns are removed.
- Admin and moderator authorization remains enforced inside database policies.
*/

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.is_admin_or_moderator(text) SET SCHEMA private;
REVOKE EXECUTE ON FUNCTION private.is_admin_or_moderator(text) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin_or_moderator(text) TO authenticated;

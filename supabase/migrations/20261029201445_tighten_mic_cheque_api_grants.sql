/*
# Tighten Mic Cheque API grants

1. Purpose
- Remove inherited broad table privileges from the browser-facing anon and authenticated roles.
- Re-grant only the operations required by the public fan experience, saved content, authentication profile, chat, reports, and protected admin workspace.

2. Security changes
- Anonymous visitors can only read intentionally public content, public settings, scheduled/open chat sessions, visible chat messages, and polls.
- Signed-in fans can only manage their own profile, saved items, votes, reports, and messages through RLS policies.
- Admin and moderator write operations retain table access but remain constrained by the existing role-aware RLS policies.
- No credentials or private profile fields are exposed by this change.

3. Important notes
- This migration changes privileges only; it does not delete tables, rows, or columns.
- RLS policies remain the authoritative row-level authorization layer.
*/

REVOKE ALL PRIVILEGES ON profiles, user_roles, events, episodes, tickets, merchandise, saved_items, chat_sessions, chat_messages, chat_polls, chat_votes, reports, user_restrictions, site_settings FROM anon, authenticated;

GRANT SELECT ON events, episodes, tickets, merchandise, chat_sessions, chat_messages, chat_polls, site_settings TO anon;

GRANT SELECT, UPDATE (display_name, avatar_url) ON profiles TO authenticated;
GRANT SELECT ON user_roles, events, episodes, tickets, merchandise, chat_sessions, chat_messages, chat_polls, chat_votes, reports, user_restrictions, site_settings TO authenticated;
GRANT INSERT, DELETE ON saved_items TO authenticated;
GRANT INSERT ON chat_messages, chat_votes, reports TO authenticated;
GRANT UPDATE, DELETE ON chat_messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON events, episodes, tickets, merchandise, chat_sessions, chat_polls, user_restrictions, site_settings TO authenticated;

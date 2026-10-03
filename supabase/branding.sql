-- Team branding (2026-10-03): logo + custom colors per team.
-- Run in the Supabase SQL editor.

alter table teams
  add column if not exists logo_url text,
  add column if not exists primary_color text;

-- Sensible defaults for existing teams.
update teams set primary_color = '#18181b' where primary_color is null;

-- Managers can update their own team's branding (app enforces manager-only
-- via the settings page; RLS managers_all_teams covers the write).

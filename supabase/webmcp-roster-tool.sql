-- WebMCP roster tool flag (see docs/WEBMCP.md).
--
-- The flag also lives in lib/flags.ts FLAG_DEFAULTS, so the tool works
-- before this row exists; seeding it makes the flag visible in the admin
-- Feature-administration UI like every other flag.

insert into feature_flags (flag_key, description, default_enabled) values
  ('webmcp-roster-tool', 'WebMCP roster tool (get_roster_week) exposed to browser agents.', true)
on conflict (flag_key) do nothing;

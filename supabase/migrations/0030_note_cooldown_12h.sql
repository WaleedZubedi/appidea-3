-- ============================================================================
-- 0030: note cooldown 6h -> 12h. APPLIED LIVE (mvyktmxkhwigrrftsbpn) as
-- `note_cooldown_12h`. _enforce_note_cooldown() now rejects a keeper's insert
-- when their previous note is < 12 hours old (was 6). The client mirrors this:
-- the composer's send lock and the note's on-screen TTL are both 12h.
-- ============================================================================
create or replace function public._enforce_note_cooldown()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_last timestamptz;
begin
  select max(created_at) into v_last from notes
    where pair_id = new.pair_id and author_id = new.author_id;
  if v_last is not null and now() - v_last < interval '12 hours' then
    raise exception 'note_cooldown';
  end if;
  return new;
end; $function$;

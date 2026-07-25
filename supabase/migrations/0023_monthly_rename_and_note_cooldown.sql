-- ============================================================================
-- 0023: Rename Bixi once a month + 6-hour note cooldown (server backstops).
--
-- APPLIED LIVE (mvyktmxkhwigrrftsbpn) on 2026-07-21 as
-- `monthly_rename_and_note_cooldown_0023`.
--
-- (1) set_bixi_name: the Bixi's name is a shared, pair-level attribute, so a
--     rename must go through the server and propagate to both keepers via
--     realtime. Allowed once every 30 days (first rename is always allowed —
--     bixi_name_changed_at starts null after hatch). Enforced server-side so
--     the limit can't be bypassed and both parents share the one-per-month cap.
-- (2) note cooldown trigger: each keeper may insert one note per 6 hours. The
--     client already gates the composer with a live timer; this is the backstop.
-- ============================================================================

alter table public.pairs add column if not exists bixi_name_changed_at timestamptz;

create or replace function public.set_bixi_name(p_pair uuid, p_name text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_last timestamptz; v_clean text;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  v_clean := nullif(btrim(p_name), '');
  if v_clean is null then raise exception 'empty_name'; end if;
  v_clean := left(v_clean, 20);
  select bixi_name_changed_at into v_last from pairs where id = p_pair;
  if v_last is not null and now() - v_last < interval '30 days' then
    raise exception 'rename_too_soon';
  end if;
  update pairs set bixi_name = v_clean, bixi_name_changed_at = now() where id = p_pair;
end; $function$;

revoke all on function public.set_bixi_name(uuid, text) from public, anon;
grant execute on function public.set_bixi_name(uuid, text) to authenticated;

create or replace function public._enforce_note_cooldown()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_last timestamptz;
begin
  select max(created_at) into v_last from notes
    where pair_id = new.pair_id and author_id = new.author_id;
  if v_last is not null and now() - v_last < interval '6 hours' then
    raise exception 'note_cooldown';
  end if;
  return new;
end; $function$;

drop trigger if exists trg_note_cooldown on public.notes;
create trigger trg_note_cooldown before insert on public.notes
  for each row execute function public._enforce_note_cooldown();

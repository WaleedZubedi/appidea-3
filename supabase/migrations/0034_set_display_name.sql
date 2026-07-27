-- Let a signed-in user set their own display name. Used for Apple sign-in, which
-- returns the full name only on the very first authorization.
create or replace function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if nullif(trim(p_name), '') is null then return; end if;
  update profiles set display_name = trim(p_name) where id = auth.uid();
end; $function$;

grant execute on function public.set_display_name(text) to authenticated;

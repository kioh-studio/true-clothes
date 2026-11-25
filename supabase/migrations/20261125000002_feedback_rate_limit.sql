-- 2026-11-25 per-user feedback insert cap: 20 / 24h (replaces the "no rate limit" note in 20260922000001_feedback.sql).
create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);

create or replace function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'feedback rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.feedback_rate_limit() from public, anon, authenticated;

create trigger feedback_rate_limit_trg before insert on public.feedback
  for each row execute function public.feedback_rate_limit();

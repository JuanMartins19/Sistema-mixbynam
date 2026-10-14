-- Aplicar depois de 002_contact_followup.sql. Agenda única do produtor.
begin;
create table public.producer_sessions (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  session_type text not null check(length(btrim(session_type)) between 2 and 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text not null default '' check(length(notes) <= 3000),
  status text not null check(status in ('reserved','confirmed','held','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  -- GiST para range é nativo; dispensa extensão paga/externa e btree_gist.
  -- Exclusão indexada é atômica inclusive entre transações simultâneas.
  constraint producer_sessions_no_overlap exclude using gist
    (tstzrange(starts_at,ends_at,'[)') with &&) where(status <> 'cancelled')
);
create index producer_sessions_project_idx on public.producer_sessions(project_id);
create index producer_sessions_start_idx on public.producer_sessions(starts_at,id);
alter table public.producer_sessions enable row level security;
revoke all on public.producer_sessions from public, anon, authenticated;
grant select on public.producer_sessions to authenticated;
create policy producer_sessions_read on public.producer_sessions for select to authenticated
  using ((select public.is_producer()));

create function public.save_producer_session(
  p_id uuid,p_project_id uuid,p_session_type text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_notes text,p_status text,p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.producer_sessions; same_payload boolean;
begin
  perform private.require_producer();
  if p_id is null or p_project_id is null or p_session_type is null
    or length(btrim(p_session_type)) not between 2 and 100 or p_notes is null or length(p_notes)>3000
    or p_status is null or p_status not in ('reserved','confirmed','held','cancelled')
    or p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_ends_at <= p_starts_at then
    raise exception 'Sessão inválida: confira tipo, início e fim' using errcode = '22023';
  end if;
  if not exists(select 1 from public.projects where id = p_project_id) then
    raise exception 'Pedido inexistente' using errcode = '22023';
  end if;
  -- Inserção repetida usa a mesma PK; on conflict aguarda transações concorrentes.
  if p_expected_updated_at is null then
    insert into public.producer_sessions(id,project_id,session_type,starts_at,ends_at,notes,status)
      values(p_id,p_project_id,btrim(p_session_type),p_starts_at,p_ends_at,p_notes,p_status)
      on conflict(id) do nothing;
  end if;
  select * into r from public.producer_sessions where id = p_id for update;
  if not found then raise exception 'Sessão inexistente. Recarregue a agenda.' using errcode = '22023'; end if;
  same_payload := r.project_id = p_project_id and r.session_type = btrim(p_session_type)
    and r.starts_at = p_starts_at and r.ends_at = p_ends_at and r.notes = p_notes and r.status = p_status;
  if same_payload then return to_jsonb(r); end if;
  if p_expected_updated_at is null or r.updated_at <> p_expected_updated_at then
    raise exception 'Sessão alterada em outra janela. Recarregue a agenda.' using errcode = '40001';
  end if;
  update public.producer_sessions set project_id = p_project_id,session_type = btrim(p_session_type),
    starts_at = p_starts_at,ends_at = p_ends_at,notes = p_notes,status = p_status,updated_at = clock_timestamp()
    where id = p_id returning * into r;
  return to_jsonb(r);
  -- Conflito GiST mantém SQLSTATE 23P01, tratado explicitamente pela interface.
end;
$$;
revoke all on function public.save_producer_session(uuid,uuid,text,timestamptz,timestamptz,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.save_producer_session(uuid,uuid,text,timestamptz,timestamptz,text,text,timestamptz) to authenticated;
commit;

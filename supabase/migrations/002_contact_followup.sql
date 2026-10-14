-- Aplicar depois de 001_projects.sql, sem reaplicar a migração inicial.
begin;
create table public.contact_tracking (
  project_id uuid primary key references public.projects(id) on delete cascade,
  commercial_status text not null default 'new'
    check (commercial_status in ('new','in_contact','proposal_sent','won','lost','do_not_contact')),
  next_action text,
  return_at timestamptz,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  check ((next_action is null) = (return_at is null)),
  check (next_action is null or length(btrim(next_action)) between 2 and 500),
  check (return_at is null or isfinite(return_at))
);
create table public.contact_history (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('tracking','note','contact')),
  body text not null check (length(btrim(body)) between 1 and 3000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  recorded_by uuid not null references auth.users(id)
);
create index contact_history_project_idx on public.contact_history(project_id,created_at desc,id desc);
create index contact_tracking_return_idx on public.contact_tracking(return_at) where return_at is not null;
alter table public.contact_tracking enable row level security;
alter table public.contact_history enable row level security;
revoke all on public.contact_tracking, public.contact_history from public, anon, authenticated;
grant select on public.contact_tracking, public.contact_history to authenticated;
create policy producer_tracking_read on public.contact_tracking for select to authenticated
  using ((select public.is_producer()));
create policy producer_history_read on public.contact_history for select to authenticated
  using ((select public.is_producer()));

create function private.require_producer() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_producer() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_producer() from public, anon, authenticated;

-- Histórico imutável; id de operação garante que retry não duplica eventos.
create function public.save_contact_tracking(
  p_project_id uuid, p_operation_id uuid, p_status text,
  p_next_action text, p_return_at timestamptz, p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.contact_tracking; prior public.contact_history; payload jsonb;
begin
  perform private.require_producer();
  if p_operation_id is null or p_status is null or p_status not in ('new','in_contact','proposal_sent','won','lost','do_not_contact')
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Acompanhamento inválido' using errcode = '22023';
  end if;
  p_next_action := nullif(btrim(p_next_action),'');
  if (p_next_action is null) <> (p_return_at is null)
    or length(p_next_action) > 500 or length(p_next_action) < 2
    or (p_return_at is not null and not isfinite(p_return_at)) then
    raise exception 'Informe próxima ação e data de retorno juntas' using errcode = '22023';
  end if;
  payload := jsonb_build_object('commercial_status',p_status,'next_action',p_next_action,'return_at',p_return_at,'expected_revision',p_expected_revision);
  -- Serializa operações do mesmo projeto, sem alterar updated_at do artista.
  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Pedido inexistente' using errcode = '22023'; end if;
  select * into prior from public.contact_history where id = p_operation_id;
  if found then
    if prior.project_id <> p_project_id or prior.kind <> 'tracking' or prior.metadata <> payload then
      raise exception 'Identificador de operação já utilizado' using errcode = '22023';
    end if;
    select * into r from public.contact_tracking where project_id = p_project_id;
    return to_jsonb(r);
  end if;
  insert into public.contact_tracking(project_id) values(p_project_id) on conflict do nothing;
  select * into r from public.contact_tracking where project_id = p_project_id for update;
  if r.revision <> p_expected_revision then
    raise exception 'Acompanhamento alterado em outra janela. Recarregue antes de salvar.' using errcode = '40001';
  end if;
  update public.contact_tracking set commercial_status = p_status, next_action = p_next_action,
    return_at = p_return_at, updated_at = clock_timestamp(), revision = revision + 1
    where project_id = p_project_id returning * into r;
  insert into public.contact_history(id,project_id,kind,body,metadata,recorded_by)
    values(p_operation_id,p_project_id,'tracking','Situação comercial / próxima ação atualizadas',payload,auth.uid());
  return to_jsonb(r);
end;
$$;
revoke all on function public.save_contact_tracking(uuid,uuid,text,text,timestamptz,bigint) from public, anon, authenticated;
grant execute on function public.save_contact_tracking(uuid,uuid,text,text,timestamptz,bigint) to authenticated;

create function public.record_contact_history(p_project_id uuid,p_id uuid,p_kind text,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.contact_history;
begin
  perform private.require_producer();
  if p_id is null or p_kind is null or p_kind not in ('note','contact') or p_body is null
    or length(btrim(p_body)) not between 1 and 3000 then
    raise exception 'Registro de atendimento inválido' using errcode = '22023';
  end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Pedido inexistente' using errcode = '22023'; end if;
  select * into r from public.contact_history where id = p_id;
  if found then
    if r.project_id <> p_project_id or r.kind <> p_kind or r.body <> btrim(p_body) then
      raise exception 'Identificador de registro já utilizado' using errcode = '22023';
    end if;
    return to_jsonb(r);
  end if;
  if p_kind = 'contact' and exists(select 1 from public.contact_tracking where project_id = p_project_id and commercial_status = 'do_not_contact') then
    raise exception 'Este contato está marcado como não contatar' using errcode = '22023';
  end if;
  insert into public.contact_history(id,project_id,kind,body,recorded_by)
    values(p_id,p_project_id,p_kind,btrim(p_body),auth.uid()) returning * into r;
  return to_jsonb(r);
end;
$$;
revoke all on function public.record_contact_history(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_contact_history(uuid,uuid,text,text) to authenticated;

-- O relógio e o filtro de recuperação são do banco; threshold é configurável pelo código.
create function public.list_producer_projects(
  p_filter text default 'all', p_offset integer default 0,
  p_limit integer default 21, p_inactivity_hours integer default 24
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_producer();
  if p_filter is null or p_filter not in ('all','completed','incomplete','recovery','pending')
    or p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 500
    or p_inactivity_hours is null or p_inactivity_hours not between 1 and 8760 then
    raise exception 'Filtro inválido' using errcode = '22023';
  end if;
  with candidates as (
    select p.*, to_jsonb(t) as tracking,
      array_remove(array[
        case when p.status = 'incomplete' and p.updated_at <= now() - make_interval(hours => p_inactivity_hours) then 'inactive' end,
        case when t.return_at <= now() then 'overdue' end,
        case when p.status = 'completed' and not exists(select 1 from public.contact_history h where h.project_id = p.id and h.kind = 'contact') then 'unattended' end
      ],null) as recovery_reasons,
      coalesce(t.commercial_status,'new') as commercial_status,
      not exists(select 1 from public.contact_history h where h.project_id = p.id and h.kind = 'contact') as pending
    from public.projects p left join public.contact_tracking t on t.project_id = p.id
  ), selected as (
    select * from candidates c where
      p_filter = 'all' or (p_filter in ('completed','incomplete') and c.status = p_filter)
      or (p_filter = 'recovery' and c.commercial_status <> 'do_not_contact' and cardinality(c.recovery_reasons) > 0)
      or (p_filter = 'pending' and c.commercial_status <> 'do_not_contact' and c.pending)
    order by created_at desc,id desc offset p_offset limit p_limit
  )
  select coalesce(jsonb_agg(to_jsonb(s) - 'commercial_status' - 'pending' order by s.created_at desc,s.id desc),'[]'::jsonb) into result from selected s;
  return result;
end;
$$;
revoke all on function public.list_producer_projects(text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.list_producer_projects(text,integer,integer,integer) to authenticated;
commit;

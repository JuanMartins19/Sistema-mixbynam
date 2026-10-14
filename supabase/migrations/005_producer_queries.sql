begin;
create function public.producer_contacts(p_filter text default 'all',p_offset integer default 0,p_limit integer default 21,p_inactivity_hours integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_producer();
  if p_filter is null or p_filter not in ('all','recovery','pending','completed','incomplete') or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 500 or p_inactivity_hours is null or p_inactivity_hours not between 1 and 8760 then raise exception 'Filtro inválido' using errcode='22023'; end if;
  with candidates as (
    select p.id,p.created_at,p.answers->>'artist_name' as artist_name,p.answers->'services' as services,p.status as form_status,p.progress,
      coalesce(t.commercial_status,'new') as commercial_status,t.next_action,t.return_at,
      not exists(select 1 from public.contact_history h where h.project_id=p.id and h.kind='contact') as pending,
      array_remove(array[
        case when p.status='incomplete' and p.updated_at<=now()-make_interval(hours=>p_inactivity_hours) then 'inactive' end,
        case when t.return_at<=now() then 'overdue' end,
        case when p.status='completed' and not exists(select 1 from public.contact_history h where h.project_id=p.id and h.kind='contact') then 'unattended' end
      ],null) as recovery_reasons
    from public.projects p left join public.contact_tracking t on t.project_id=p.id
  ), selected as (
    select * from candidates c where p_filter='all' or (p_filter in('completed','incomplete') and c.form_status=p_filter)
      or (p_filter='recovery' and c.commercial_status not in('won','lost','do_not_contact') and cardinality(c.recovery_reasons)>0)
      or (p_filter='pending' and c.commercial_status not in('won','lost','do_not_contact') and c.pending)
    order by created_at desc,id desc offset p_offset limit p_limit
  ) select coalesce(jsonb_agg(to_jsonb(s)-'pending'-'created_at' order by s.created_at desc,s.id desc),'[]') into result from selected s;
  return jsonb_build_object('queried_at',now(),'rows',result);
end; $$;
revoke all on function public.producer_contacts(text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.producer_contacts(text,integer,integer,integer) to authenticated;

-- Compatibilidade para clientes anteriores, também corrige a recuperação.
create or replace function public.list_producer_projects(p_filter text default 'all',p_offset integer default 0,p_limit integer default 21,p_inactivity_hours integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_producer();
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('tracking',to_jsonb(t),'recovery_reasons',item->'recovery_reasons') order by p.created_at desc,p.id desc),'[]') into result
    from jsonb_array_elements(public.producer_contacts(p_filter,p_offset,p_limit,p_inactivity_hours)->'rows') item
    join public.projects p on p.id=(item->>'id')::uuid left join public.contact_tracking t on t.project_id=p.id;
  return result;
end; $$;

create function public.producer_history(p_project_id uuid,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_producer();
  if (p_before is null)<>(p_before_id is null) then raise exception 'Cursor inválido' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') into result from(
    select * from public.contact_history where project_id=p_project_id and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 21
  )x;
  return result;
end; $$;
revoke all on function public.producer_history(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.producer_history(uuid,timestamptz,uuid) to authenticated;

create function public.producer_contact_detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
  perform private.require_producer();
  select jsonb_build_object('queried_at',now(),'project',to_jsonb(p),'tracking',(select to_jsonb(t) from public.contact_tracking t where project_id=p.id),'history',public.producer_history(p.id)) into r from public.projects p where id=p_id;
  if r is null then raise exception 'Pedido inexistente' using errcode='22023'; end if;
  return r;
end; $$;
revoke all on function public.producer_contact_detail(uuid) from public,anon,authenticated;
grant execute on function public.producer_contact_detail(uuid) to authenticated;

create function public.producer_update_tracking(p_project_id uuid,p_operation_id uuid,p_status text,p_next_action text,p_return_at timestamptz,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t jsonb;
begin
  perform private.require_producer();
  t:=public.save_contact_tracking(p_project_id,p_operation_id,p_status,p_next_action,p_return_at,p_expected_revision);
  return jsonb_build_object('tracking',t,'event',(select to_jsonb(h) from public.contact_history h where id=p_operation_id),'queried_at',now());
end; $$;
revoke all on function public.producer_update_tracking(uuid,uuid,text,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.producer_update_tracking(uuid,uuid,text,text,timestamptz,bigint) to authenticated;

create function public.producer_agenda(p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;
begin
  perform private.require_producer();
  if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or p_end-p_start>interval '62 days' then raise exception 'Período inválido' using errcode='22023'; end if;
  select coalesce(jsonb_agg(x.r order by x.starts_at,x.id),'[]') into rows from(
    select s.id,s.starts_at,to_jsonb(s)||jsonb_build_object('artist_name',p.answers->>'artist_name','public_id',p.public_id) as r
    from public.producer_sessions s join public.projects p on p.id=s.project_id where s.starts_at<p_end and s.ends_at>p_start
  )x;
  return jsonb_build_object('queried_at',now(),'rows',rows);
end; $$;
revoke all on function public.producer_agenda(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.producer_agenda(timestamptz,timestamptz) to authenticated;
create function public.producer_find_projects(p_search text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_producer();
  if p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 then raise exception 'Busca inválida' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') from(
    select id,public_id,answers->>'artist_name' as artist_name,created_at from public.projects
    where p_search='' or answers->>'artist_name' ilike '%'||p_search||'%' or public_id::text=p_search
    order by created_at desc,id desc offset p_offset limit 21
  )x);
end; $$;
revoke all on function public.producer_find_projects(text,integer) from public,anon,authenticated;
grant execute on function public.producer_find_projects(text,integer) to authenticated;
commit;

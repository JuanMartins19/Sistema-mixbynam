-- Aplicar após 007. Novo fluxo grava somente solicitações enviadas.
-- Não apaga dados antigos: incompletos ficam bloqueados para uso comercial.
begin;
alter table public.projects
  alter column consent_at drop not null, alter column consent_at drop default,
  alter column consent_version drop not null, alter column consent_version drop default,
  alter column consent_text drop not null, alter column consent_text drop default,
  add column privacy_notice_version text,
  add column privacy_notice_at timestamptz,
  add column marketing_allowed boolean not null default false,
  add column marketing_choice_at timestamptz,
  add column marketing_consent_at timestamptz,
  add column marketing_consent_version text,
  add column marketing_consent_text text,
  add column marketing_revoked_at timestamptz;

-- Impede clientes antigos/diretos de continuar a coleta parcial.
revoke execute on function public.save_project(uuid,text,integer,jsonb) from anon,authenticated;

create function public.submit_project(p_id uuid,p_token text,p_answers jsonb,p_marketing boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; patch jsonb; inserted uuid; i integer;
begin
  if p_id is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_marketing is null then
    raise exception 'Pedido inválido' using errcode='22023'; end if;
  for i in 1..4 loop perform private.validate_stage(p_answers,i); end loop;
  select jsonb_object_agg(key,value) into patch from jsonb_each(p_answers)
    where key=any(array['artist_name','whatsapp','email','genre','arrangement','arrangement_other',
      'services','beat_type','references','no_references','notes','budget','needs_guidance','deadline']);
  insert into public.projects(id,answers,progress,status,completed_at,privacy_notice_version,privacy_notice_at,
    marketing_allowed,marketing_choice_at,marketing_consent_at,marketing_consent_version,marketing_consent_text)
    values(p_id,patch,4,'completed',now(),'2026-10-14-privacy-v2',now(),p_marketing,now(),
      case when p_marketing then now() end,'2026-10-14-marketing-v1',
      'Quero receber novidades, ofertas e lançamentos da Beatz By Nam por WhatsApp ou e-mail. Sei que posso cancelar essa autorização a qualquer momento.')
    on conflict(id) do nothing returning id into inserted;
  if inserted is not null then
    insert into private.project_keys(project_id,token_hash)
      values(p_id,pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')));
  end if;
  select * into r from public.projects where id=p_id for update;
  if not exists(select 1 from private.project_keys where project_id=p_id
    and token_hash=pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'))) then
    raise exception 'Pedido indisponível' using errcode='42501'; end if;
  if r.status<>'completed' then raise exception 'Inicie uma nova solicitação' using errcode='22023'; end if;
  return to_jsonb(r);
end; $$;
revoke all on function public.submit_project(uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.submit_project(uuid,text,jsonb,boolean) to anon,authenticated;

create function public.revoke_project_marketing(p_id uuid,p_token text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.is_producer() and not exists(select 1 from private.project_keys k
    join public.projects p on p.id=k.project_id where p.id=p_id and p.status='completed'
      and p_token ~ '^[a-f0-9]{64}$' and k.token_hash=pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'))) then
    raise exception 'Pedido indisponível' using errcode='42501'; end if;
  update public.projects set marketing_allowed=false,marketing_revoked_at=clock_timestamp()
    where id=p_id and status='completed' and marketing_allowed;
  return true;
end; $$;
revoke all on function public.revoke_project_marketing(uuid,text) from public,anon,authenticated;
grant execute on function public.revoke_project_marketing(uuid,text) to anon,authenticated;

-- Consultas diretas do painel/exportação não oferecem contatos incompletos.
alter policy producer_read on public.projects using ((select public.is_producer()) and status='completed');

create or replace function private.validate_stage(a jsonb, s integer) returns void
language plpgsql set search_path = '' as $$
declare k text; required_keys text[]; svc jsonb;
begin
  if a is null or jsonb_typeof(a) <> 'object' or octet_length(a::text) > 16000 then
    raise exception 'Respostas inválidas' using errcode = '22023';
  end if;
  required_keys := case s
    when 1 then array['artist_name','whatsapp','email']
    when 2 then array['genre','arrangement','arrangement_other']
    when 3 then array['beat_type','references','notes']
    when 4 then array['budget','deadline'] else array[]::text[] end;
  foreach k in array required_keys loop
    if jsonb_typeof(a->k) is distinct from 'string' then
      raise exception 'Campo inválido: %', k using errcode = '22023';
    end if;
  end loop;
  if s = 1 then
    if length(btrim(a->>'artist_name')) not between 2 and 100
      or a->>'whatsapp' !~ '^[0-9]{10,15}$'
      or length(a->>'email') > 254
      or ((a->>'email') <> '' and (a->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 then
      raise exception 'Contato inválido' using errcode = '22023';
    end if;
  elsif s = 2 then
    if length(btrim(a->>'genre')) not between 2 and 100
      or a->>'arrangement' not in ('solo','team','other')
      or length(a->>'arrangement_other') > 200
      or (a->>'arrangement' = 'other' and length(btrim(a->>'arrangement_other')) < 2) then
      raise exception 'Atuação inválida' using errcode = '22023';
    end if;
  elsif s = 3 then
    if jsonb_typeof(a->'services') is distinct from 'array' then
      raise exception 'Serviços inválidos' using errcode = '22023';
    end if;
    if jsonb_array_length(a->'services') not between 1 and 7
      or exists (select 1 from jsonb_array_elements(a->'services') v
        where jsonb_typeof(v) <> 'string' or v #>> '{}' not in ('beat','recording','editing','mixing','mastering','tuning','live'))
      or (select count(distinct v) from jsonb_array_elements(a->'services') v) <> jsonb_array_length(a->'services')
      or ((a->'services') ? 'beat' and a->>'beat_type' not in ('ready','exclusive','custom'))
      or jsonb_typeof(a->'no_references') is distinct from 'boolean'
      or length(a->>'references') > 2000 or length(a->>'notes') > 3000 then
      raise exception 'Produção inválida' using errcode = '22023';
    end if;
    if a->'no_references' = 'false'::jsonb then
      if length(btrim(a->>'references')) = 0 or exists (
        select 1 from regexp_split_to_table(a->>'references', E'\n') link
        where btrim(link) <> '' and btrim(link) !~ '^https?://[^[:space:]/]+[^[:space:]]*$'
      ) then raise exception 'Referências inválidas' using errcode = '22023'; end if;
    end if;
  elsif s = 4 then
    if jsonb_typeof(a->'needs_guidance') is distinct from 'boolean'
      or length(a->>'budget') > 100
      or (a->'needs_guidance' = 'false'::jsonb and length(btrim(a->>'budget')) < 2)
      or length(btrim(a->>'deadline')) not between 2 and 200 then
      raise exception 'Orçamento ou prazo inválidos' using errcode = '22023';
    end if;
  else raise exception 'Etapa inválida' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.validate_stage(jsonb,integer) from public, anon, authenticated;

create or replace function public.resume_project(p_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.projects;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Pedido indisponível' using errcode = '42501';
  end if;
  select p.* into r from public.projects p join private.project_keys k on k.project_id = p.id
    where p.id = p_id and k.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'));
  if not found or r.status <> 'completed' then raise exception 'Pedido indisponível' using errcode = '42501'; end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.resume_project(uuid,text) from public, anon, authenticated;
grant execute on function public.resume_project(uuid,text) to anon, authenticated;

create or replace function public.producer_contacts(p_filter text default 'all',p_offset integer default 0,p_limit integer default 21,p_inactivity_hours integer default 24)
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
    from public.projects p left join public.contact_tracking t on t.project_id=p.id where p.status='completed'
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

create or replace function public.producer_contact_detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
  perform private.require_producer();
  select jsonb_build_object('queried_at',now(),'project',to_jsonb(p),'tracking',(select to_jsonb(t) from public.contact_tracking t where project_id=p.id),'history',public.producer_history(p.id)) into r from public.projects p where id=p_id and status='completed';
  if r is null then raise exception 'Pedido inexistente' using errcode='22023'; end if;
  return r;
end; $$;
revoke all on function public.producer_contact_detail(uuid) from public,anon,authenticated;
grant execute on function public.producer_contact_detail(uuid) to authenticated;

create or replace function public.producer_find_projects(p_search text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_producer();
  if p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 then raise exception 'Busca inválida' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') from(
    select id,public_id,answers->>'artist_name' as artist_name,created_at from public.projects
    where status='completed' and (p_search='' or answers->>'artist_name' ilike '%'||p_search||'%' or public_id::text=p_search)
    order by created_at desc,id desc offset p_offset limit 21
  )x);
end; $$;
revoke all on function public.producer_find_projects(text,integer) from public,anon,authenticated;
grant execute on function public.producer_find_projects(text,integer) to authenticated;


create or replace function public.producer_find_financial_projects(p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_producer();
  if p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 then
    raise exception 'Busca inválida' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') from(
    select p.id,p.public_id,p.answers->>'artist_name' as artist_name,p.created_at from public.projects p
    where p.status='completed' and not exists(select 1 from public.project_contracts c where c.project_id=p.id and c.finalized_at is not null)
      and (p_search='' or p.answers->>'artist_name' ilike '%'||p_search||'%' or p.public_id::text=p_search)
    order by p.created_at desc,p.id desc offset p_offset limit 21
  )x);
end; $$;
revoke all on function public.producer_find_financial_projects(text,integer) from public,anon,authenticated;
grant execute on function public.producer_find_financial_projects(text,integer) to authenticated;

create or replace function public.producer_history(p_project_id uuid,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_producer();
  if not exists(select 1 from public.projects where id=p_project_id and status='completed') then return '[]'::jsonb; end if;
  if (p_before is null)<>(p_before_id is null) then raise exception 'Cursor inválido' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') into result from(
    select * from public.contact_history where project_id=p_project_id and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 21
  )x;
  return result;
end; $$;
revoke all on function public.producer_history(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.producer_history(uuid,timestamptz,uuid) to authenticated;


alter policy producer_tracking_read on public.contact_tracking using (
  (select public.is_producer()) and exists(select 1 from public.projects p where p.id=project_id and p.status='completed'));
alter policy producer_history_read on public.contact_history using (
  (select public.is_producer()) and exists(select 1 from public.projects p where p.id=project_id and p.status='completed'));
create function private.guard_submitted_contact() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.projects where id=new.project_id and status='completed') then
    raise exception 'Solicitação não enviada: atendimento bloqueado' using errcode='55000';
  end if;
  return new;
end; $$;
revoke all on function private.guard_submitted_contact() from public,anon,authenticated;
create trigger only_submitted_tracking before insert or update on public.contact_tracking
  for each row execute function private.guard_submitted_contact();
create trigger only_submitted_history before insert on public.contact_history
  for each row execute function private.guard_submitted_contact();
commit;

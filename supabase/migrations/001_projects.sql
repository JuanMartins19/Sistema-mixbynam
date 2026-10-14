-- Executar no SQL Editor do Supabase, como postgres. Sem service_role na aplicação.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.projects (
  id uuid primary key,
  public_id uuid not null unique default gen_random_uuid(),
  answers jsonb not null default '{}'::jsonb,
  progress smallint not null default 1 check (progress between 1 and 4),
  status text not null default 'incomplete' check (status in ('incomplete', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-10-14-v1',
  consent_text text not null default 'Autorizo o produtor a usar meu nome artístico, WhatsApp, e-mail e respostas para atendimento e contato sobre este projeto, inclusive se eu não concluir o formulário. Não autorizo publicidade de outros projetos.',
  check ((status = 'completed') = (completed_at is not null)),
  check (status <> 'completed' or progress = 4)
);
create index projects_created_at_idx on public.projects (created_at desc, id desc);
create index projects_status_idx on public.projects (status, created_at desc);
create table private.project_keys (
  project_id uuid primary key references public.projects(id) on delete cascade,
  token_hash bytea not null
);
-- Exatamente um produtor previamente criado. Nenhum cadastro público de administradores.
create table private.producer (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.projects enable row level security;
alter table private.project_keys enable row level security;
alter table private.producer enable row level security;
revoke all on public.projects from public, anon, authenticated;
revoke all on private.project_keys, private.producer from public, anon, authenticated;
grant select on public.projects to authenticated;

create function public.is_producer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.producer where user_id = auth.uid());
$$;
revoke all on function public.is_producer() from public, anon, authenticated;
grant execute on function public.is_producer() to authenticated;
create policy producer_read on public.projects for select to authenticated
  using ((select public.is_producer()));
-- Não há políticas públicas de SELECT/INSERT/UPDATE/DELETE.

create function private.validate_stage(a jsonb, s integer) returns void
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
      or (a->'consent') is distinct from 'true'::jsonb then
      raise exception 'Contato ou autorização inválidos' using errcode = '22023';
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

create function public.save_project(p_id uuid, p_token text, p_step integer, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.projects; patch jsonb; allowed text[]; hashed bytea; i integer;
begin
  if p_id is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_step is null or p_step not between 1 and 4 then
    raise exception 'Pedido inválido' using errcode = '22023';
  end if;
  hashed := pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'));
  perform private.validate_stage(p_answers, p_step);
  allowed := case p_step
    when 1 then array['artist_name','whatsapp','email','consent']
    when 2 then array['genre','arrangement','arrangement_other']
    when 3 then array['services','beat_type','references','no_references','notes']
    when 4 then array['budget','needs_guidance','deadline'] end;
  select jsonb_object_agg(key,value) into patch from jsonb_each(p_answers) where key = any(allowed);
  if p_step = 1 then
    -- PK, não telefone, é a chave de idempotência. Conflitos concorrentes aguardam a transação.
    insert into public.projects(id,answers) values(p_id,patch) on conflict(id) do nothing;
    -- Somente o criador do registro pode instalar a chave: se ela já existir, não altera.
    insert into private.project_keys(project_id,token_hash) values(p_id,hashed) on conflict(project_id) do nothing;
  end if;
  select * into r from public.projects where id = p_id for update;
  if not found or not exists(select 1 from private.project_keys where project_id = p_id and token_hash = hashed) then
    raise exception 'Pedido indisponível' using errcode = '42501';
  end if;
  if r.status = 'completed' then return to_jsonb(r); end if;
  if p_step > r.progress + 1 then raise exception 'Conclua as etapas anteriores' using errcode = '22023'; end if;
  if p_step = 4 then
    for i in 1..3 loop perform private.validate_stage(r.answers, i); end loop;
  end if;
  update public.projects set answers = answers || patch, progress = greatest(progress,p_step),
    updated_at = now(), status = case when p_step = 4 then 'completed' else 'incomplete' end,
    completed_at = case when p_step = 4 then now() else null end
    where id = p_id returning * into r;
  return to_jsonb(r);
end;
$$;
revoke all on function public.save_project(uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.save_project(uuid,text,integer,jsonb) to anon, authenticated;

-- Recuperação na mesma aba: somente com UUID + segredo de 256 bits. O ID público não dá acesso.
create function public.resume_project(p_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.projects;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Pedido indisponível' using errcode = '42501';
  end if;
  select p.* into r from public.projects p join private.project_keys k on k.project_id = p.id
    where p.id = p_id and k.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'));
  if not found then raise exception 'Pedido indisponível' using errcode = '42501'; end if;
  return to_jsonb(r);
end;
$$;
revoke all on function public.resume_project(uuid,text) from public, anon, authenticated;
grant execute on function public.resume_project(uuid,text) to anon, authenticated;
commit;

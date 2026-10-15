-- Executar no SQL Editor do MESMO banco usado pela automação do GitHub.
-- O responsável informou que executou todas as migrações com sucesso.
-- Registra 001 a 011; scripts de setup não são migrações.
-- Não executa novamente as migrações nem apaga dados.
-- As verificações abaixo detectam ausências comuns; não substituem a
-- confirmação de execução integral dos arquivos originais.
begin;
do $$
declare object_name text; function_body text;
begin
  foreach object_name in array array[
    'public.projects','private.project_keys','private.producer',
    'public.contact_tracking','public.contact_history','public.producer_sessions',
    'public.project_contracts','public.contract_history','public.finance_entries',
    'private.phone_lengths'
  ] loop
    if to_regclass(object_name) is null then
      raise exception 'Registro cancelado: objeto ausente: %', object_name;
    end if;
  end loop;

  select prosrc into function_body from pg_catalog.pg_proc
    where oid=to_regprocedure('public.finance_month_summary(date,integer)');
  if function_body is null then
    raise exception 'Registro cancelado: confira a migração 007.';
  end if;

  select prosrc into function_body from pg_catalog.pg_proc
    where oid=to_regprocedure('private.validate_stage(jsonb,integer)');
  if function_body is null or strpos(function_body, 'private.valid_whatsapp')=0 then
    raise exception 'Registro cancelado: confira a migração 009.';
  end if;
  if strpos(function_body, $marker$a->>'beat_type' <> ''$marker$)=0 then
    raise exception 'Registro cancelado: aplique 010_optional_beat_type.sql e tente novamente.';
  end if;

  select prosrc into function_body from pg_catalog.pg_proc
    where oid=to_regprocedure('public.submit_project(uuid,text,jsonb,boolean)');
  if function_body is null or strpos(function_body, '2026-10-14-privacy-v3')=0
    or strpos(function_body, '2026-10-14-marketing-v2')=0 then
    raise exception 'Registro cancelado: aplique 011_mix_by_nam_privacy_text.sql e tente novamente.';
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values
  ('001', 'projects'),
  ('002', 'contact_followup'),
  ('003', 'producer_schedule'),
  ('004', 'manual_finance'),
  ('005', 'producer_queries'),
  ('006', 'finance_completion'),
  ('007', 'finance_month_details'),
  ('008', 'submission_privacy'),
  ('009', 'whatsapp_validation'),
  ('010', 'optional_beat_type'),
  ('011', 'mix_by_nam_privacy_text')
on conflict (version) do nothing;
commit;

select version, name from supabase_migrations.schema_migrations order by version;

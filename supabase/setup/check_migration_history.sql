-- Diagnóstico SOMENTE LEITURA. Executar no SQL Editor como postgres.
-- Não consulta nomes, telefones, respostas ou credenciais de clientes.
-- Presença dos objetos ajuda a investigar; não prova execução integral de uma migração.
select
  to_regclass('supabase_migrations.schema_migrations') is not null as historico_existe,
  to_regclass('public.projects') is not null as projects_existe,
  to_regclass('private.project_keys') is not null as chaves_existem,
  to_regclass('private.producer') is not null as produtor_existe,
  to_regprocedure('public.is_producer()') is not null as autorizacao_existe,
  to_regprocedure('public.save_project(uuid,text,integer,jsonb)') is not null as funcao_original_existe,
  to_regprocedure('public.resume_project(uuid,text)') is not null as retomada_existe;

-- Consultar o histórico abaixo SE historico_existe=true no resultado anterior.
-- Execute esta segunda consulta separadamente.
-- select version, name from supabase_migrations.schema_migrations order by version;

-- Execute no SQL Editor do banco que apresentou o erro no GitHub.
-- Usar SOMENTE se 001_projects.sql já foi executada integralmente com sucesso.
-- Registra apenas 001; não cria tabelas, não apaga dados e não registra 002 em diante.
-- Equivalente ao registro realizado por migration repair 001 --status applied.
begin;
insert into supabase_migrations.schema_migrations (version, name)
values ('001', 'projects')
on conflict (version) do nothing;
commit;

select version, name
from supabase_migrations.schema_migrations
order by version;

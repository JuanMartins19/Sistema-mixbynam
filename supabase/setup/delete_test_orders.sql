-- Limpeza autorizada de TODOS os pedidos de teste.
-- Execute no SQL Editor do Supabase como postgres, no projeto de testes.
-- As exclusões em cascata removem chaves dos pedidos, contatos, históricos,
-- sessões, contratos e lançamentos financeiros vinculados aos pedidos.
-- Preserva a estrutura, o usuário produtor e o histórico de migrações.
begin;
delete from public.projects;
commit;
